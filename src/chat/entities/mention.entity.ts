// src/chat/entities/mention.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  BeforeInsert,
  UpdateDateColumn,
} from 'typeorm';

import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { v4 as uuidv4 } from 'uuid';
import { Message } from './Message.entity';

@Entity('mentions')
export class Mention {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }

  @ManyToOne(() => Message, (m) => m.mentions, { onDelete: 'CASCADE' })
  message: Message;

  @ManyToOne(() => Staff, { eager: true })
  user: Staff;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
