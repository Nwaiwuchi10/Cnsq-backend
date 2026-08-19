// src/tasks/entities/task.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  PrimaryColumn,
  BeforeInsert,
  JoinColumn,
} from 'typeorm';
import { Project } from 'src/projects/entities/project.entity';
import { TaskAssignment } from './task-asessment.entity';
import { TaskComment } from './task-comments.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Department } from 'src/departments/entities/department.entity';
import { v4 as uuidv4 } from 'uuid';

export enum TaskStatus {
  NOT_STARTED = 'Not_started',
  IN_PROGRESS = 'In_progress',
  READY_TO_TEST = 'Ready_To_Test',
  TESTIN_IN_PROGRESS = 'Testing_In_Progress',
  ON_HOLD = 'On_Hold',
  FAILED_TEST = 'Failed_Test',
  Dev_COMPLETED = 'Passed_Test',
  Dev_Setup_Completed = 'Dev_Completed',
  COMPLETED = 'Completed',
}
export enum PriorityLevel {
  LOW = 'Low',
  Medium = 'Medium',
  HIGH = 'High',
}
export enum URGENCY {
  SHORT_TERM = 'Short_Term',
  MED_TERM = 'Med_Term',
  HIGH_TERM = 'High_Term',
  IMMEDIATELY = 'Immediately',
}
@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  // @PrimaryColumn('uuid')
  // id: string;

  // @BeforeInsert()
  // generateId() {
  //   if (!this.id) {
  //     this.id = uuidv4();
  //   }
  // }

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  taskModule?: string;

  @Column({ type: 'int', default: 1 })
  sprint: number;

  @Column({
    type: 'enum',
    enum: TaskStatus,
    default: TaskStatus.NOT_STARTED,
  })
  status: TaskStatus;

  @Column({
    type: 'enum',
    enum: PriorityLevel,
    default: PriorityLevel.Medium,
  })
  priority: PriorityLevel;

  @Column({
    type: 'enum',
    enum: URGENCY,
    default: URGENCY.SHORT_TERM,
  })
  urgency: URGENCY;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  startDate?: Date;
  @Column({
    type: 'timestamp',
    nullable: true,
  })
  dueDate?: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  timeline?: string;

  @ManyToOne(() => Project, (project) => project.tasks, {
    onDelete: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'projectId' })
  project?: Project;

  @Column({ type: 'int', nullable: true })
  linkedProjectId?: number;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'departmentId' })
  department?: Department;
  // @ManyToOne(() => Project, (project) => project.id, {
  //   onDelete: 'CASCADE',
  //   nullable: true,
  // })
  // @JoinColumn({ name: 'projectId' })
  // project?: Project;

  @ManyToOne(() => Staff, { eager: true, nullable: true })
  @JoinColumn({ name: 'createdBy_id' })
  createdBy: Staff;

  @OneToMany(() => TaskAssignment, (assignment) => assignment.task, {
    cascade: true,
  })
  assignedTo: TaskAssignment[];

  @OneToMany(() => TaskComment, (comment) => comment.task, {
    cascade: true,
  })
  comments: TaskComment[];
  @CreateDateColumn()
  createdAt: Date;

  @CreateDateColumn({ type: 'timestamp', nullable: true })
  completed_Date: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
