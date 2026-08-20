// src/calls/calls.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { CallsService } from './calls.service';
import { CallType, CallScope } from './entities/call.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from 'src/chat/entities/conversation.entity';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/calls',
})
@Injectable()
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private logger = new Logger('CallsGateway');

  // Reuse same user tracking pattern as ChatGateway
  private userSockets = new Map<number, Set<string>>(); // userId → Set(socketId)
  private socketToUser = new Map<string, number>(); // socketId → userId

  // Active calls: callId → Set(userId) of active participants
  private activeCalls = new Map<string, Set<number>>();

  // Map callId → participantInfo (for existing-participants relay)
  private callParticipantInfo = new Map<string, Map<number, { firstName: string; lastName: string; avatar?: string | null }>>();

  // Ringing timeout handles: callId → NodeJS.Timeout
  private ringTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly callsService: CallsService,
    @InjectRepository(Conversation)
    private convRepo: Repository<Conversation>,
  ) {}

  // ─────────────────────────────── CONNECTION ───────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.query?.token as string;
      if (!token) { client.disconnect(true); return; }

      const secret = process.env.JWT_SECRET;
      if (!secret) { client.disconnect(true); return; }

      const payload = jwt.verify(token, secret) as any;
      const userId = payload.staffId || payload.sub || payload.id;
      if (!userId) { client.disconnect(true); return; }

      const sockets = this.userSockets.get(userId) || new Set();
      sockets.add(client.id);
      this.userSockets.set(userId, sockets);
      this.socketToUser.set(client.id, userId);
      client.join(`user:${userId}`);

      this.logger.log(`[Calls] Connected: ${client.id} (user ${userId})`);
    } catch (err) {
      this.logger.warn(`[Calls] Auth failed: ${err.message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);

          // If the user has no more connected sockets, remove them from any active calls
          for (const [callId, participants] of this.activeCalls.entries()) {
            if (participants.has(userId)) {
              try {
                const { call, fullyEnded } = await this.callsService.endCall(callId, userId);

                // Remove disconnected user's info from participant info map
                const infoMap = this.callParticipantInfo.get(callId);
                if (infoMap) infoMap.delete(userId);

                if (fullyEnded) {
                  this.server.to(`call:${callId}`).emit('call:ended', {
                    callId,
                    endedBy: userId,
                    scope: call.scope,
                    durationSeconds: call.durationSeconds,
                    durationText: this.callsService.formatDuration(call.durationSeconds ?? 0),
                  });
                  this.activeCalls.delete(callId);
                  this.callParticipantInfo.delete(callId);
                } else {
                  // Group call: notify others that this user left — call continues
                  this.server.to(`call:${callId}`).emit('call:left', { callId, userId });
                  participants.delete(userId);
                  if (participants.size === 0) {
                    this.activeCalls.delete(callId);
                    this.callParticipantInfo.delete(callId);
                  }
                }
              } catch (e) {
                this.logger.error(`Error cleaning up call ${callId} for disconnected user ${userId}`);
              }
            }
          }
        }
      }
      this.socketToUser.delete(client.id);
    }
  }

  // ─────────────────────────────── INITIATE CALL ────────────────────────────

  /**
   * Caller fires: { conversationId, type: 'audio'|'video', scope: 'dm'|'group' }
   * Server creates DB record, rings all other members
   */
  @SubscribeMessage('call:initiate')
  async handleInitiateCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; type: CallType; scope: CallScope },
  ) {
    const callerId = this.socketToUser.get(client.id);
    if (!callerId) return;

    try {
      const call = await this.callsService.createCall(callerId, {
        conversationId: body.conversationId,
        type: body.type,
        scope: body.scope,
      });

      // Load conversation members
      const conv = await this.convRepo.findOne({
        where: { id: body.conversationId },
        relations: ['members', 'members.user', 'createdBy'],
      });

      if (!conv) return;

      // Join the call room
      client.join(`call:${call.id}`);
      this.activeCalls.set(call.id, new Set([callerId]));

      // Track caller's participant info for mesh signaling
      const infoMap = new Map<number, { firstName: string; lastName: string; avatar?: string | null }>();
      infoMap.set(callerId, {
        firstName: call.initiator.firstName,
        lastName: call.initiator.lastName,
        avatar: call.initiator.photoUrl,
      });
      this.callParticipantInfo.set(call.id, infoMap);

      // Emit ringing to all other members
      const otherMembers = conv.members.filter((m) => m.user.id !== callerId);

      for (const member of otherMembers) {
        this.server.to(`user:${member.user.id}`).emit('call:incoming', {
          callId: call.id,
          type: call.type,
          scope: call.scope,
          conversationId: body.conversationId,
          initiatorId: call.initiator.id,
          caller: {
            id: call.initiator.id,
            firstName: call.initiator.firstName,
            lastName: call.initiator.lastName,
            avatar: call.initiator.photoUrl,
          },
          conversationName: conv.name || null,
        });
      }

      // Confirm to caller
      client.emit('call:initiated', {
        callId: call.id,
        type: call.type,
        scope: call.scope,
        conversationId: body.conversationId,
        initiatorId: callerId,
      });

      // Auto-timeout after 30 seconds if nobody answers
      const timeout = setTimeout(async () => {
        try {
          const currentCall = await this.callsService.getCall(call.id);
          if (currentCall.status === 'ringing') {
            await this.callsService.markMissed(call.id);
            // Notify caller: missed
            this.server.to(`call:${call.id}`).emit('call:missed', { callId: call.id });
            // Notify all callees
            for (const member of otherMembers) {
              this.server.to(`user:${member.user.id}`).emit('call:missed', { callId: call.id });
            }
          }
        } catch (e) {
          this.logger.warn(`[Calls] Timeout cleanup failed for call ${call.id}: ${e.message}`);
        }
        this.ringTimeouts.delete(call.id);
      }, 30_000);

      this.ringTimeouts.set(call.id, timeout);

      this.logger.log(`[Calls] Call ${call.id} initiated by user ${callerId}`);
    } catch (err) {
      this.logger.error(`[Calls] Initiate failed: ${err.message}`);
      client.emit('call:error', { message: err.message });
    }
  }

  // ─────────────────────────────── ACCEPT CALL ──────────────────────────────

  @SubscribeMessage('call:accept')
  async handleAcceptCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; userInfo?: { firstName: string; lastName: string; avatar?: string | null } },
  ) {
    const userId = this.socketToUser.get(client.id);
    if (!userId) return;

    try {
      const call = await this.callsService.acceptCall(body.callId, userId);

      // Clear ring timeout
      const timeout = this.ringTimeouts.get(body.callId);
      if (timeout) {
        clearTimeout(timeout);
        this.ringTimeouts.delete(body.callId);
      }

      // Collect existing participants BEFORE joining room (so we can tell the new joiner)
      const existingParticipants: Array<{ userId: number; firstName: string; lastName: string; avatar?: string | null }> = [];
      const participants = this.activeCalls.get(body.callId) || new Set<number>();
      const infoMap = this.callParticipantInfo.get(body.callId) || new Map();

      for (const existingUserId of participants) {
        const info = infoMap.get(existingUserId);
        existingParticipants.push({
          userId: existingUserId,
          firstName: info?.firstName || '',
          lastName: info?.lastName || '',
          avatar: info?.avatar || null,
        });
      }

      // Join call room
      client.join(`call:${body.callId}`);

      participants.add(userId);
      this.activeCalls.set(body.callId, participants);

      // Store this user's info
      if (body.userInfo) {
        infoMap.set(userId, body.userInfo);
        this.callParticipantInfo.set(body.callId, infoMap);
      }

      // ── CRITICAL FIX: Tell the new joiner who is already in the call ──
      // This allows them to create peer connections to existing participants.
      // The new joiner acts as "initiator" toward all existing participants.
      client.emit('call:existing-participants', {
        callId: body.callId,
        participants: existingParticipants,
      });

      // Notify all in call room that this user accepted (so existing users can expect an offer from the new joiner)
      this.server.to(`call:${body.callId}`).emit('call:accepted', {
        callId: body.callId,
        userId,
        userInfo: body.userInfo || null,
      });

      this.logger.log(`[Calls] Call ${body.callId} accepted by user ${userId}. Existing participants: ${existingParticipants.map(p => p.userId).join(', ')}`);
    } catch (err) {
      client.emit('call:error', { message: err.message });
    }
  }

  // ─────────────────────────────── ADD PARTICIPANT ──────────────────────────

  @SubscribeMessage('call:add-participant')
  async handleAddParticipant(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string, targetUserId: number },
  ) {
    const initiatorId = this.socketToUser.get(client.id);
    if (!initiatorId) return;

    try {
      const { call, newParticipant } = await this.callsService.addParticipantToCall(body.callId, initiatorId, body.targetUserId);

      // Emit incoming call to the new user
      this.server.to(`user:${body.targetUserId}`).emit('call:incoming', {
        callId: call.id,
        type: call.type,
        scope: call.scope,
        conversationId: call.conversation.id,
        caller: {
          id: call.initiator.id,
          firstName: call.initiator.firstName,
          lastName: call.initiator.lastName,
          avatar: call.initiator.photoUrl,
        },
        conversationName: call.conversation.name || null,
      });

      // Notify the call room that someone was invited
      this.server.to(`call:${body.callId}`).emit('call:participant-added', {
        callId: body.callId,
        participant: {
          userId: newParticipant.user.id,
          firstName: newParticipant.user.firstName,
          lastName: newParticipant.user.lastName,
          avatar: newParticipant.user.photoUrl,
        },
      });

      this.logger.log(`[Calls] Call ${body.callId}: user ${initiatorId} invited user ${body.targetUserId}`);
    } catch (err) {
      client.emit('call:error', { message: err.message });
    }
  }

  // ─────────────────────────────── REMOVE PARTICIPANT ───────────────────────

  @SubscribeMessage('call:remove-participant')
  async handleRemoveParticipant(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; targetUserId: number },
  ) {
    const initiatorId = this.socketToUser.get(client.id);
    if (!initiatorId) return;

    try {
      await this.callsService.removeParticipantFromCall(body.callId, initiatorId, body.targetUserId);

      // Notify the kicked user to leave
      this.server.to(`user:${body.targetUserId}`).emit('call:removed', {
        callId: body.callId,
        removedBy: initiatorId,
      });

      // Notify the rest of the call room
      this.server.to(`call:${body.callId}`).emit('call:left', {
        callId: body.callId,
        userId: body.targetUserId,
      });

      // Update local tracking
      const participants = this.activeCalls.get(body.callId);
      if (participants) {
        participants.delete(body.targetUserId);
      }

      // Remove from info map
      const infoMap = this.callParticipantInfo.get(body.callId);
      if (infoMap) infoMap.delete(body.targetUserId);

      this.logger.log(`[Calls] Call ${body.callId}: user ${initiatorId} removed user ${body.targetUserId}`);
    } catch (err) {
      client.emit('call:error', { message: err.message });
    }
  }

  // ─────────────────────────────── DECLINE CALL ─────────────────────────────

  @SubscribeMessage('call:decline')
  async handleDeclineCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string },
  ) {
    const userId = this.socketToUser.get(client.id);
    if (!userId) return;

    try {
      const call = await this.callsService.declineCall(body.callId, userId);

      // Notify caller + call room
      this.server.to(`call:${body.callId}`).emit('call:declined', {
        callId: body.callId,
        userId,
      });

      // For DM: clear timeout — call is done
      if (call.scope === 'dm') {
        const timeout = this.ringTimeouts.get(body.callId);
        if (timeout) {
          clearTimeout(timeout);
          this.ringTimeouts.delete(body.callId);
        }
      }

      this.logger.log(`[Calls] Call ${body.callId} declined by user ${userId}`);
    } catch (err) {
      client.emit('call:error', { message: err.message });
    }
  }

  // ─────────────────────────────── END CALL ─────────────────────────────────

  @SubscribeMessage('call:end')
  async handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string },
  ) {
    const userId = this.socketToUser.get(client.id);
    if (!userId) return;

    try {
      const { call, fullyEnded } = await this.callsService.endCall(body.callId, userId);

      // Remove this user from participant info map
      const infoMap = this.callParticipantInfo.get(body.callId);
      if (infoMap) infoMap.delete(userId);

      // Clear ring timeout if still pending
      const timeout = this.ringTimeouts.get(body.callId);
      if (timeout && fullyEnded) {
        clearTimeout(timeout);
        this.ringTimeouts.delete(body.callId);
      }

      if (fullyEnded) {
        // Notify all participants that the call is over
        this.server.to(`call:${body.callId}`).emit('call:ended', {
          callId: body.callId,
          endedBy: userId,
          scope: call.scope,
          durationSeconds: call.durationSeconds,
          durationText: this.callsService.formatDuration(call.durationSeconds ?? 0),
        });

        // Cleanup the call room completely
        this.activeCalls.delete(body.callId);
        this.callParticipantInfo.delete(body.callId);
        this.logger.log(`[Calls] Call ${body.callId} fully ended by user ${userId}`);
      } else {
        // ── CRITICAL: Group call continues — just this participant leaves ──
        // Remove the leaving socket from the call room FIRST so they stop receiving events
        client.leave(`call:${body.callId}`);

        // Now notify remaining participants that this user left
        this.server.to(`call:${body.callId}`).emit('call:left', {
          callId: body.callId,
          userId,
        });

        // Remove from local tracking set
        const set = this.activeCalls.get(body.callId);
        if (set) {
          set.delete(userId);
          if (set.size === 0) {
            this.activeCalls.delete(body.callId);
            this.callParticipantInfo.delete(body.callId);
          }
        }

        this.logger.log(`[Calls] Call ${body.callId} — user ${userId} left the call. Remaining: ${this.activeCalls.get(body.callId)?.size ?? 0}`);
      }
    } catch (err) {
      client.emit('call:error', { message: err.message });
    }
  }

  // ─────────────────── WebRTC SIGNALING RELAY ───────────────────────────────

  /**
   * Relay WebRTC SDP offer to a specific peer
   */
  @SubscribeMessage('call:webrtc-offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; targetUserId: number; sdp: RTCSessionDescriptionInit },
  ) {
    this.server.to(`user:${body.targetUserId}`).emit('call:webrtc-offer', {
      callId: body.callId,
      fromUserId: this.socketToUser.get(client.id),
      sdp: body.sdp,
    });
  }

  /**
   * Relay WebRTC SDP answer back to the caller
   */
  @SubscribeMessage('call:webrtc-answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; targetUserId: number; sdp: RTCSessionDescriptionInit },
  ) {
    this.server.to(`user:${body.targetUserId}`).emit('call:webrtc-answer', {
      callId: body.callId,
      fromUserId: this.socketToUser.get(client.id),
      sdp: body.sdp,
    });
  }

  /**
   * Relay ICE candidate between peers
   */
  @SubscribeMessage('call:ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; targetUserId: number; candidate: RTCIceCandidateInit },
  ) {
    this.server.to(`user:${body.targetUserId}`).emit('call:ice-candidate', {
      callId: body.callId,
      fromUserId: this.socketToUser.get(client.id),
      candidate: body.candidate,
    });
  }

  // ─────────────────── IN-CALL CONTROL EVENTS ───────────────────────────────

  /**
   * Broadcast mute status to all call participants
   */
  @SubscribeMessage('call:mute-toggle')
  handleMuteToggle(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; muted: boolean },
  ) {
    const userId = this.socketToUser.get(client.id);
    this.server.to(`call:${body.callId}`).emit('call:peer-muted', {
      userId,
      muted: body.muted,
    });
  }

  /**
   * Broadcast video toggle status to all call participants
   */
  @SubscribeMessage('call:video-toggle')
  handleVideoToggle(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; videoEnabled: boolean },
  ) {
    const userId = this.socketToUser.get(client.id);
    this.server.to(`call:${body.callId}`).emit('call:peer-video', {
      userId,
      videoEnabled: body.videoEnabled,
    });
  }

  /**
   * Broadcast screen share status
   */
  @SubscribeMessage('call:screen-share')
  handleScreenShare(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; sharing: boolean },
  ) {
    const userId = this.socketToUser.get(client.id);
    this.server.to(`call:${body.callId}`).emit('call:peer-screen', {
      userId,
      sharing: body.sharing,
    });
  }

  /**
   * Raise hand in group call
   */
  @SubscribeMessage('call:raise-hand')
  handleRaiseHand(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; raised: boolean },
  ) {
    const userId = this.socketToUser.get(client.id);
    this.server.to(`call:${body.callId}`).emit('call:hand-raised', {
      userId,
      raised: body.raised,
    });
  }

  /**
   * In-call emoji reaction
   */
  @SubscribeMessage('call:reaction')
  handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; emoji: string },
  ) {
    const userId = this.socketToUser.get(client.id);
    this.server.to(`call:${body.callId}`).emit('call:reaction', {
      userId,
      emoji: body.emoji,
    });
  }

  /**
   * Speaking detection — active speaker
   */
  @SubscribeMessage('call:speaking')
  handleSpeaking(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; speaking: boolean },
  ) {
    const userId = this.socketToUser.get(client.id);
    this.server.to(`call:${body.callId}`).emit('call:peer-speaking', {
      userId,
      speaking: body.speaking,
    });
  }

  /**
   * Network quality indication (e.g., poor connection)
   */
  @SubscribeMessage('call:network-quality')
  handleNetworkQuality(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; hasPoorConnection: boolean },
  ) {
    const userId = this.socketToUser.get(client.id);
    this.server.to(`call:${body.callId}`).emit('call:network-quality', {
      userId,
      hasPoorConnection: body.hasPoorConnection,
    });
  }
}
