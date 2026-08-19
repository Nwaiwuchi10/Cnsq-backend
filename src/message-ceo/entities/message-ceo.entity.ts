import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { v4 as uuidv4 } from 'uuid';

import {
  Entity,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  PrimaryColumn,
} from 'typeorm';

@Entity('messages')
export class MessageCeo {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }

  @Column({ type: 'text' })
  subject: string;

  @Column({ type: 'text' })
  content: string;

  // Optional: store file URLs
  @Column('text', { array: true, nullable: true })
  attachments?: string[];

  @ManyToOne(() => Staff, (staff) => staff.id, { eager: true })
  sender: Staff;

  @Column({ type: 'text', nullable: true })
  replyContent?: string;

  @Column('text', { array: true, nullable: true })
  replyAttachments?: string[];

  @Column({ type: 'timestamp', nullable: true })
  repliedAt?: Date;

  @ManyToOne(() => Staff, { nullable: true })
  replier?: Staff;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
