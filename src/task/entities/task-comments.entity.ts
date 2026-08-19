// src/projects/entities/project-comment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';

import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Task } from './task.entity';
import { v4 as uuidv4 } from 'uuid';
@Entity('task_comments')
export class TaskComment {
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

  @ManyToOne(() => Task, (task) => task.comments, {
    onDelete: 'CASCADE',
  })
  task: Task;

  @ManyToOne(() => Staff, { eager: true, onDelete: 'CASCADE' })
  mentionedStaff: Staff;

  @ManyToOne(() => Staff, { eager: true, onDelete: 'CASCADE' })
  staff: Staff;

  @Column({ type: 'text' })
  text: string;

  @Column({ nullable: true })
  fileUrl?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
