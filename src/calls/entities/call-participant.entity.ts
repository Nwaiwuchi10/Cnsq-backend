// src/calls/entities/call-participant.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Call } from './call.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

export enum ParticipantStatus {
  INVITED = 'invited',
  JOINED = 'joined',
  LEFT = 'left',
  DECLINED = 'declined',
  MISSED = 'missed',
}

@Entity('call_participants')
export class CallParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }

  @ManyToOne(() => Call, (c) => c.participants, { onDelete: 'CASCADE' })
  call: Call;

  @ManyToOne(() => Staff, { eager: true })
  user: Staff;

  @Column({
    type: 'enum',
    enum: ParticipantStatus,
    default: ParticipantStatus.INVITED,
  })
  status: ParticipantStatus;

  @Column({ type: 'timestamp', nullable: true })
  joinedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  leftAt?: Date;

  @CreateDateColumn()
  createdAt: Date;
}
