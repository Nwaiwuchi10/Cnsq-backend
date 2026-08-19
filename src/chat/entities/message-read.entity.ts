// src/chat/entities/message_read.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  CreateDateColumn,
  Index,
  BeforeInsert,
  UpdateDateColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

import { v4 as uuidv4 } from 'uuid';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

@Entity('message_reads')
@Index(['conversation', 'user'], { unique: true })
export class MessageRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }

  @ManyToOne(() => Conversation)
  conversation: Conversation;

  @ManyToOne(() => Staff)
  user: Staff;

  // last message id read by user in conversation (helps compute unread counts)
  @Column({ nullable: true })
  lastReadMessageId?: string;

  // @CreateDateColumn()
  // updatedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
