// src/projects/entities/project-assignment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';

import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Task } from './task.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('task_assignments')
export class TaskAssignment {
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

  @ManyToOne(() => Task, (task) => task.assignedTo, {
    onDelete: 'CASCADE',
  })
  task: Task;

  @ManyToOne(() => Staff, { eager: true, onDelete: 'CASCADE' })
  staff: Staff;

  @Column({ type: 'varchar', length: 100 })
  role: string;
}
