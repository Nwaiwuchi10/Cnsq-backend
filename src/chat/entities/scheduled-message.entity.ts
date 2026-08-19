import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Conversation } from './conversation.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

export enum ScheduleFrequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  ONCE = 'once',
}

@Entity('scheduled_messages')
export class ScheduledMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  conversation: Conversation;

  @ManyToOne(() => Staff, { eager: true })
  author: Staff;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'enum', enum: ScheduleFrequency, default: ScheduleFrequency.DAILY })
  frequency: ScheduleFrequency;

  // Time format "HH:mm" (e.g. "09:00")
  @Column({ type: 'varchar', length: 10 })
  scheduledTime: string;

  // Day of week for weekly schedule: 0 = Sun, 1 = Mon, ..., 6 = Sat
  @Column({ type: 'int', nullable: true })
  dayOfWeek?: number;

  @Column({ type: 'timestamp', nullable: true })
  lastRunAt?: Date;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
