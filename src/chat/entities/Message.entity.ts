// src/chat/entities/message.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  BeforeInsert,
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { v4 as uuidv4 } from 'uuid';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Attachment } from './attachment.entity';
import { Mention } from './mention.entity';
import { Reaction } from './reaction.entity';
import { ThreadReply } from './thread-reply.entity';


export enum MessageType {
  TEXT = 'text',
  JOIN = 'join',
  LEAVE = 'leave',
  FORWARD = 'forward',
}

@Entity('chat_messages')
@Index(['conversation', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }

  @Column({ type: 'enum', enum: MessageType, default: MessageType.TEXT })
  type: MessageType;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  conversation: Conversation;

  @ManyToOne(() => Staff, { eager: true })
  author: Staff;

  // plain text. Use markdown/plain/html sanitized on output if required.
  @Column({ type: 'text', nullable: true })
  text?: string;

  // optional parent for threads
  @ManyToOne(() => Message, { nullable: true })
  parent?: Message;

  @OneToMany(() => Message, (m) => m.parent, { cascade: true })
  replies: Message[];

  @OneToMany(() => ThreadReply, (tr) => tr.message, { cascade: true })
  repliesInThread: ThreadReply[];


  // allow edit history optionally
  @Column({ default: false })
  edited: boolean;

  @Column({ default: false })
  pinned: boolean;

  @OneToMany(() => Attachment, (a) => a.message, { cascade: true, eager: true })
  attachments: Attachment[];

  @OneToMany(() => Reaction, (r) => r.message, { cascade: true, eager: true })
  reactions: Reaction[];

  @OneToMany(() => Mention, (m) => m.message, { cascade: true })
  mentions: Mention[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;

  repliesInThreadCount?: number;
}
