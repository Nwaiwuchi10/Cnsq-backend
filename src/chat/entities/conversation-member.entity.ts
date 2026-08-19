// src/chat/entities/conversation-member.entity.ts
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

export enum MemberRole {
  MEMBER = 'member',
  ADMIN = 'admin',
  OWNER = 'owner',
}

@Entity('conversation_members')
@Index(['conversation', 'user'], { unique: true })
export class ConversationMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }

  @ManyToOne(() => Conversation, (c) => c.members, { onDelete: 'CASCADE' })
  conversation: Conversation;

  @ManyToOne(() => Staff, { eager: true })
  user: Staff;

  @Column({ type: 'enum', enum: MemberRole, default: MemberRole.MEMBER })
  role: MemberRole;

  // user-specific settings for the conversation
  @Column({ default: true })
  notificationsEnabled: boolean;

  @Column({ default: 0 })
  unreadCount: number;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
