// src/calls/calls.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Call, CallStatus, CallType, CallScope } from './entities/call.entity';
import { CallParticipant, ParticipantStatus } from './entities/call-participant.entity';
import { Conversation } from 'src/chat/entities/conversation.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { InitiateCallDto } from './dto/initiate-call.dto';

@Injectable()
export class CallsService {
  constructor(
    @InjectRepository(Call)
    private callRepo: Repository<Call>,
    @InjectRepository(CallParticipant)
    private participantRepo: Repository<CallParticipant>,
    @InjectRepository(Conversation)
    private convRepo: Repository<Conversation>,
    @InjectRepository(Staff)
    private staffRepo: Repository<Staff>,
  ) {}

  /**
   * Create a new call record when a user initiates a call
   */
  async createCall(initiatorId: number, dto: InitiateCallDto): Promise<Call> {
    const initiator = await this.staffRepo.findOne({ where: { id: initiatorId } });
    if (!initiator) throw new NotFoundException('Initiator not found');

    const conversation = await this.convRepo.findOne({
      where: { id: dto.conversationId },
      relations: ['members', 'members.user'],
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const call = this.callRepo.create({
      type: dto.type,
      scope: dto.scope,
      status: CallStatus.RINGING,
      conversation,
      initiator,
    });
    const savedCall = await this.callRepo.save(call);

    // Create participant record for initiator
    const initiatorParticipant = this.participantRepo.create({
      call: savedCall,
      user: initiator,
      status: ParticipantStatus.JOINED,
      joinedAt: new Date(),
    });
    await this.participantRepo.save(initiatorParticipant);

    // Create INVITED participant records for other members
    const otherMembers = conversation.members.filter(
      (m) => m.user.id !== initiatorId,
    );
    for (const member of otherMembers) {
      const participant = this.participantRepo.create({
        call: savedCall,
        user: member.user,
        status: ParticipantStatus.INVITED,
      });
      await this.participantRepo.save(participant);
    }

    return savedCall;
  }

  /**
   * Accept a call — update participant status to JOINED
   */
  async acceptCall(callId: string, userId: number): Promise<Call> {
    const call = await this.callRepo.findOne({
      where: { id: callId },
      relations: ['participants', 'participants.user', 'conversation'],
    });
    if (!call) throw new NotFoundException('Call not found');

    // Update call status to ACTIVE on first accept
    if (call.status === CallStatus.RINGING) {
      call.status = CallStatus.ACTIVE;
      call.startedAt = new Date();
      await this.callRepo.save(call);
    }

    // Update participant status
    const participant = call.participants.find((p) => p.user.id === userId);
    if (participant) {
      participant.status = ParticipantStatus.JOINED;
      participant.joinedAt = new Date();
      await this.participantRepo.save(participant);
    }

    return call;
  }

  /**
   * Decline a call
   */
  async declineCall(callId: string, userId: number): Promise<Call> {
    const call = await this.callRepo.findOne({
      where: { id: callId },
      relations: ['participants', 'participants.user'],
    });
    if (!call) throw new NotFoundException('Call not found');

    const participant = call.participants.find((p) => p.user.id === userId);
    if (participant) {
      participant.status = ParticipantStatus.DECLINED;
      await this.participantRepo.save(participant);
    }

    // For DM call: if the callee declines, end the call
    if (call.scope === CallScope.DM) {
      call.status = CallStatus.DECLINED;
      call.endedAt = new Date();
      await this.callRepo.save(call);
    }

    return call;
  }

  /**
   * Leave or End a call
   */
  async endCall(callId: string, userId: number): Promise<{ call: Call; fullyEnded: boolean }> {
    const call = await this.callRepo.findOne({
      where: { id: callId },
      relations: ['participants', 'participants.user'],
    });
    if (!call) throw new NotFoundException('Call not found');

    const now = new Date();
    
    // Find the participant who is leaving
    const leavingParticipant = call.participants.find(p => p.user.id === userId);
    if (leavingParticipant && leavingParticipant.status === ParticipantStatus.JOINED) {
      leavingParticipant.status = ParticipantStatus.LEFT;
      leavingParticipant.leftAt = now;
      await this.participantRepo.save(leavingParticipant);
    }

    // Determine how many participants are still JOINED
    const remainingCount = call.participants.filter(p => p.status === ParticipantStatus.JOINED).length;

    // If it's a DM call, OR if it's a group call with < 2 participants remaining, end it entirely.
    // (A group call ends if 0 or 1 active participants remain).
    if (call.scope === CallScope.DM || remainingCount < 2) {
      call.status = CallStatus.ENDED;
      call.endedAt = now;

      if (call.startedAt) {
        call.durationSeconds = Math.round(
          (now.getTime() - call.startedAt.getTime()) / 1000,
        );
      }

      await this.callRepo.save(call);

      // Mark all remaining participants as left
      for (const participant of call.participants) {
        if (participant.status === ParticipantStatus.JOINED) {
          participant.status = ParticipantStatus.LEFT;
          participant.leftAt = now;
          await this.participantRepo.save(participant);
        }
      }

      return { call, fullyEnded: true };
    }

    // Call is still ongoing
    return { call, fullyEnded: false };
  }


  /**
   * Add a new external participant to an active group call
   */
  async addParticipantToCall(callId: string, initiatorId: number, targetUserId: number): Promise<{ call: Call, newParticipant: CallParticipant }> {
    const call = await this.callRepo.findOne({
      where: { id: callId },
      relations: ['initiator', 'participants', 'participants.user', 'conversation'],
    });
    if (!call) throw new NotFoundException('Call not found');

    if (call.initiator.id !== initiatorId) {
      throw new ForbiddenException('Only the initiator can add external members to the call');
    }

    if (call.scope !== CallScope.GROUP) {
      throw new BadRequestException('Can only add external members to group calls');
    }

    // Check if target user is already in call
    const exists = call.participants.find(p => p.user.id === targetUserId);
    if (exists) {
      throw new BadRequestException('User is already invited to this call');
    }

    const targetUser = await this.staffRepo.findOne({ where: { id: targetUserId } });
    if (!targetUser) throw new NotFoundException('Target user not found');

    const participant = this.participantRepo.create({
      call,
      user: targetUser,
      status: ParticipantStatus.INVITED,
    });
    const savedParticipant = await this.participantRepo.save(participant);

    call.participants.push(savedParticipant);

    return { call, newParticipant: savedParticipant };
  }

  /**
   * Mark a call as missed (timeout)
   */
  async markMissed(callId: string): Promise<Call | null> {
    const call = await this.callRepo.findOne({
      where: { id: callId },
      relations: ['participants', 'participants.user'],
    });
    if (!call) return null;

    if (call.status === CallStatus.RINGING) {
      call.status = CallStatus.MISSED;
      call.endedAt = new Date();
      await this.callRepo.save(call);

      for (const p of call.participants) {
        if (p.status === ParticipantStatus.INVITED) {
          p.status = ParticipantStatus.MISSED;
          await this.participantRepo.save(p);
        }
      }
    }

    return call;
  }

  /**
   * Get call history for a conversation (for call log in chat)
   */
  async getCallHistory(conversationId: string, limit = 20, offset = 0): Promise<Call[]> {
    return this.callRepo.find({
      where: { conversation: { id: conversationId } },
      relations: ['initiator', 'participants', 'participants.user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get a single call by ID
   */
  async getCall(callId: string): Promise<Call> {
    const call = await this.callRepo.findOne({
      where: { id: callId },
      relations: ['initiator', 'participants', 'participants.user', 'conversation'],
    });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  /**
   * Get user's full call log
   */
  async getUserCallLog(userId: number, limit = 30, offset = 0) {
    return this.participantRepo.find({
      where: { user: { id: userId } },
      relations: ['call', 'call.initiator', 'call.conversation', 'call.participants', 'call.participants.user'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Format duration for display (e.g. "3 min 22 sec")
   */
  formatDuration(seconds: number): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} sec`;
    return `${mins} min ${secs} sec`;
  }
}
