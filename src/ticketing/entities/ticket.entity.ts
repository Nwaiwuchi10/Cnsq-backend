import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Department } from 'src/departments/entities/department.entity';
import { TicketActivity } from './ticket-activity.entity';
import { Project } from 'src/projects/entities/project.entity';
import { Task } from 'src/task/entities/task.entity';


export enum TicketPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export enum TicketStatus {
  OPEN = 'Open',
  IN_PROGRESS = 'In Progress',
  COMPLETED = 'Completed',
}

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  ticketRef: string; // e.g., TKT-001

  @Column()
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
  })
  priority: TicketPriority;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.OPEN,
  })
  status: TicketStatus;

  @Column('simple-array', { nullable: true })
  attachments: string[];

  // Relationships
  @ManyToOne(() => Department)
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ nullable: true })
  departmentId: number;

  @ManyToOne(() => Staff)
  @JoinColumn({ name: 'creatorId' })
  creator: Staff;

  @Column({ nullable: true })
  creatorId: number;

  @OneToMany(() => TicketActivity, (activity) => activity.ticket)
  activities: TicketActivity[];

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'linkedProjectId' })
  linkedProject: Project;

  @Column({ nullable: true })
  linkedProjectId: number;

  @ManyToOne(() => Task)
  @JoinColumn({ name: 'linkedTaskId' })
  linkedTask: Task;

  @Column({ nullable: true })
  linkedTaskId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
