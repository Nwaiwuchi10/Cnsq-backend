// src/projects/entities/project.entity.ts
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { ProjectAssignment } from './project-assessment.entity';
import { ProjectComment } from './project-comment.entity';
import { Department } from 'src/departments/entities/department.entity';
import { v4 as uuidv4 } from 'uuid';
import { Task } from 'src/task/entities/task.entity';

export enum ProjectStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  TESTING = 'testing',
  COMPLETED = 'completed',
}

export enum ProjectPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'uuid',
    unique: true,
    nullable: false,
  })
  uuid: string;

  @BeforeInsert()
  generateUuid() {
    if (!this.uuid) {
      this.uuid = uuidv4(); // generate safely in Node.js
    }
  }

  // @Column({
  //   type: 'uuid',
  //   unique: true,
  //   default: () => 'gen_random_uuid()', // auto-generates in Postgres
  // })
  // uuid: string;

  // @BeforeInsert()
  // generateUuid() {
  //   if (!this.uuid) {
  //     this.uuid = uuidv4();
  //   }
  // }

  @Column({ type: 'varchar', length: 255 })
  projectName: string;

  @Column({ type: 'text', nullable: true })
  desc?: string;

  @Column({ type: 'text', nullable: true })
  timeLine?: string;
  @ManyToOne(() => Department, { eager: true, nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department;
  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.NOT_STARTED,
  })
  status: ProjectStatus;

  @OneToMany(() => Task, (task) => task.project)
  tasks: Task[];

  @Column({
    type: 'enum',
    enum: ProjectPriority,
    default: ProjectPriority.MEDIUM,
  })
  priority: ProjectPriority;

  @Column({ type: 'varchar', length: 500, nullable: true })
  prodUrl?: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  stagingUrl?: string;

  @Column({ nullable: true })
  apk?: string;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date | null;

  // Creator of the project
  @ManyToOne(() => Staff, { eager: true, nullable: false })
  createdBy: Staff;

  // Relations
  @OneToMany(() => ProjectAssignment, (assignment) => assignment.project, {
    cascade: true,
  })
  assignedTo: ProjectAssignment[];

  @OneToMany(() => ProjectComment, (comment) => comment.project, {
    cascade: true,
  })
  comments: ProjectComment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
