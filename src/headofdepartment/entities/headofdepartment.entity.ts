// src/head-of-department/entities/head-of-department.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Column,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Department } from 'src/departments/entities/department.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('heads_of_departments')
export class HeadOfDepartment {
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

  @Column({ nullable: true })
  name: string;

  @ManyToOne(() => Staff, { eager: true })
  @JoinColumn({ name: 'staffId' })
  staff: Staff;

  @ManyToOne(() => Department, { eager: true })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
