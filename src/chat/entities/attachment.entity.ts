/// src/chat/entities/attachment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  BeforeInsert,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Message } from './Message.entity';
import { ThreadReply } from './thread-reply.entity';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }

  @ManyToOne(() => Message, (m) => m.attachments, { onDelete: 'CASCADE', nullable: true })
  message: Message;

  @ManyToOne(() => ThreadReply, (tr) => tr.attachments, { onDelete: 'CASCADE', nullable: true })
  threadReply: ThreadReply;

  // location in S3 or CDN
  @Column({ nullable: true })
  url: string;

  @Column({ length: 140, nullable: true })
  filename?: string;

  @Column({ type: 'bigint', nullable: true })
  size?: number;

  @Column({ length: 60, nullable: true })
  mimeType?: string;

  // optional file provider metadata
  @Column({ nullable: true })
  provider?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
