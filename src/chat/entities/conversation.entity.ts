// src/chat/entities/conversation.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index,
  BeforeInsert,
  ManyToOne,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ConversationMember } from './conversation-member.entity';
import { Message } from './Message.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
// import { ConversationMember } from './conversation-member.entity';
// import { Message } from './message.entity';

export enum ConversationType {
  CHANNEL = 'channel',
  PRIVATE = 'private', // private channel (invite-only)
  DM = 'dm', // 1:1 direct message
  GROUP_DM = 'group_dm', // multi-user DM
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }

  @Column({ type: 'enum', enum: ConversationType })
  type: ConversationType;

  // for public channels
  @Column({ length: 200, nullable: true })
  name?: string;

  @Column({ nullable: true })
  description?: string;

  // slug or short name for channels (#general)
  @Index({ unique: false })
  @Column({ length: 100, nullable: true })
  slug?: string;

  @Column({ default: false })
  isArchived: boolean;

  @OneToMany(() => ConversationMember, (m) => m.conversation, { cascade: true })
  members: ConversationMember[];

  @OneToMany(() => Message, (msg) => msg.conversation)
  messages: Message[];

  @ManyToOne(() => Staff, { eager: true })
  createdBy: Staff;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /////optional
  @Column({ type: 'timestamp', nullable: true })
  lastMessageAt?: Date;
  @ManyToOne(() => Message, { nullable: true, eager: true })
  lastMessage?: Message;
}
