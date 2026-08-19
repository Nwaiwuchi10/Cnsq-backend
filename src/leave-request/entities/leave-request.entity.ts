import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinTable,
  JoinColumn,
} from 'typeorm';
import { Staff } from '../../staff-register/entities/staff-register.entity';

export enum LeaveType {
  ANNUAL = 'Annual Leave',
  SICK = 'Sick Leave',
  STUDY = 'Study Leave',
  EMERGENCY = 'Emergency Leave',
  PATERNITY = "Paternity Leave",
  MATERNITY = "Maternity Leave",
  BEREAVEMENT = "Bereavement Leave",
  WEDDING = "Wedding Leave",
  VACATION = "Vacation Leave",



}

export enum LeaveStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  DECLINED = 'Declined',
  CANCELLED = 'Cancelled',
  COMPLETED = 'Completed',
}

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: LeaveType,
  })
  leaveType: LeaveType;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'int' })
  durationDays: number;

  @Column({ type: 'text' })
  reason: string;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'staffId' })
  staff: Staff;

  @Column()
  staffId: number;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'handoverStaffId' })
  handoverStaff: Staff;

  @Column()
  handoverStaffId: number;

  @Column({ type: 'text', nullable: true })
  handoverNotes: string;

  @Column({ nullable: true })
  attachedDocument: string;

  @ManyToMany(() => Staff)
  @JoinTable({ name: 'leave_request_supervisors' })
  supervisors: Staff[];

  @Column({
    type: 'enum',
    enum: LeaveStatus,
    default: LeaveStatus.PENDING,
  })
  status: LeaveStatus;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: Staff;

  @Column({ nullable: true })
  reviewedById: number;

  @Column({ type: 'text', nullable: true })
  reviewNotes: string;

  @CreateDateColumn()
  submittedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
