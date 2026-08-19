// src/chat/entities/reaction.entity.ts
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

import { v4 as uuidv4 } from 'uuid';
import { Message } from './Message.entity';
import { ThreadReply } from './thread-reply.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

@Entity('reactions')
@Index(['message', 'threadReply', 'user', 'emoji'], { unique: true })
export class Reaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }
  @ManyToOne(() => Message, (m) => m.reactions, { onDelete: 'CASCADE', nullable: true })
  message: Message;

  @ManyToOne(() => ThreadReply, (tr) => tr.reactions, { onDelete: 'CASCADE', nullable: true })
  threadReply: ThreadReply;

  @ManyToOne(() => Staff, { eager: true })
  user: Staff;

  // emoji short code e.g. ":thumbsup:" or unicode
  @Column({ length: 64 })
  emoji: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
