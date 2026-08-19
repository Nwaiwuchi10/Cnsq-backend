// src/calls/entities/call.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Conversation } from 'src/chat/entities/conversation.entity';
import { CallParticipant } from './call-participant.entity';


export enum CallType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum CallScope {
  DM = 'dm',
  GROUP = 'group',
}

export enum CallStatus {
  RINGING = 'ringing',
  ACTIVE = 'active',
  ENDED = 'ended',
  MISSED = 'missed',
  DECLINED = 'declined',
}

@Entity('calls')
export class Call {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }

  @Column({ type: 'enum', enum: CallType })
  type: CallType;

  @Column({ type: 'enum', enum: CallScope })
  scope: CallScope;

  @Column({
    type: 'enum',
    enum: CallStatus,
    default: CallStatus.RINGING,
  })
  status: CallStatus;

  // The conversation this call belongs to (DM or Channel)
  @ManyToOne(() => Conversation, { nullable: true, onDelete: 'SET NULL' })
  conversation: Conversation;

  // Who initiated the call
  @ManyToOne(() => Staff, { eager: true, nullable: false })
  initiator: Staff;

  // Duration in seconds (set when call ends)
  @Column({ type: 'int', nullable: true })
  durationSeconds?: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt?: Date;

  @OneToMany(() => CallParticipant, (p) => p.call, { cascade: true, eager: true })
  participants: CallParticipant[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
