import { Staff } from 'src/staff-register/entities/staff-register.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  ManyToOne,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EventType {
  MEETING = 'MEETING',
  SPRINT = 'SPRINT',
  REVIEW = 'REVIEW',
  PERSONAL = 'PERSONAL',
  PROJECT = 'PROJECT',
}

export enum RecurrenceFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

@Entity('calendar_events')
export class CalendarEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'timestamp' })
  startTime: Date;

  @Column({ type: 'timestamp' })
  endTime: Date;

  @Column({ nullable: true })
  location?: string;

  @Column({ nullable: true })
  meetingLink?: string;

  @Column({ default: '#22c55e' }) // color code
  color: string;

  @Column({ type: 'enum', enum: EventType, default: EventType.MEETING })
  type: EventType;

  @Column({ default: false })
  isRecurring: boolean;

  @Column({ nullable: true })
  recurrenceRule?: string; // RRULE:FREQ=WEEKLY;BYDAY=MO

  @Column({ type: 'enum', enum: RecurrenceFrequency, nullable: true })
  recurrenceFrequency?: RecurrenceFrequency;

    @Column({ type: 'timestamp', nullable: true })
    recurrenceEndDate?: Date;

  @ManyToOne(() => Staff, { eager: true })
  createdBy: Staff;

  @ManyToMany(() => Staff, { eager: true })
  @JoinTable({ name: 'calendar_event_attendees' })
  attendees: Staff[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
