// src/staff/entities/staff-employment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { Staff } from './staff-register.entity';
import { Department } from 'src/departments/entities/department.entity';
import { DepartmentalRole } from 'src/departmental-role/entities/departmental-role.entity';
import { v4 as uuidv4 } from 'uuid';

export enum EmploymentType {
  FULL_TIME = 'Full-Time',
  PART_TIME = 'Part-Time',
  CONTRACT = 'Contract',
  INTERN = 'Intern',
}

export enum WorkMode {
  ONSITE = 'Onsite',
  REMOTE = 'Remote',
  HYBRID = 'Hybrid',
}

export enum EmploymentStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  SUSPENDED = 'Suspended',
  TERMINATED = 'Terminated',
}

@Entity('staff_employment')
export class StaffEmployment {
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

  @Column({ length: 40, unique: false })
  employeeCode: string; // e.g., CN-000123

  @Column('text', { array: true, nullable: true })
  jobTitle: string[];

  @Column({ type: 'enum', enum: EmploymentType })
  employmentType: EmploymentType;

  @Column({ type: 'enum', enum: WorkMode, default: WorkMode.ONSITE })
  workMode: WorkMode;

  @Column({ type: 'date' })
  hireDate: string;

  @Column({ length: 80 })
  reportingManager: string;

  @Column({ length: 80 })
  directReport: string;

  @Column({ type: 'date', nullable: true })
  contractEndDate?: string;

  @Column({
    type: 'enum',
    enum: EmploymentStatus,
    default: EmploymentStatus.ACTIVE,
  })
  status: EmploymentStatus;

  @Column({ length: 160, nullable: true })
  workLocation?: string;

  // Department relation
  @ManyToOne(() => Department, {
    nullable: false,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  // DepartmentalRole relation
  @ManyToOne(() => DepartmentalRole, {
    nullable: false,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'departmental_role_id' })
  departmentalRole: DepartmentalRole;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
