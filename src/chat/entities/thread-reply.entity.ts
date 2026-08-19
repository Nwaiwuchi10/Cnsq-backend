// src/chat/entities/thread-reply.entity.ts
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
import { v4 as uuidv4 } from 'uuid';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Message } from './Message.entity';
import { Attachment } from './attachment.entity';
import { Reaction } from './reaction.entity';

@Entity('thread_replies')
@Index(['message', 'createdAt'])
export class ThreadReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }

  @ManyToOne(() => Message, (m) => m.repliesInThread, { onDelete: 'CASCADE' })
  message: Message;

  @ManyToOne(() => Staff, { eager: true })
  author: Staff;

  @Column({ type: 'text', nullable: true })
  text?: string;

  @Column({ default: false })
  edited: boolean;

  @OneToMany(() => Attachment, (a) => a.threadReply, { cascade: true, eager: true })
  attachments: Attachment[];

  @ManyToOne(() => ThreadReply, (tr) => tr.replies, { nullable: true, onDelete: 'CASCADE' })
  parent?: ThreadReply;

  @OneToMany(() => ThreadReply, (tr) => tr.parent, { cascade: true })
  replies: ThreadReply[];

  @OneToMany(() => Reaction, (r) => r.threadReply, { cascade: true, eager: true })
  reactions: Reaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt?: Date;
}
