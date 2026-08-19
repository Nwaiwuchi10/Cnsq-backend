// src/projects/entities/project-comment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { Project } from './project.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('project_comments')
export class ProjectComment {
  @PrimaryGeneratedColumn()
  id: number;

  // @PrimaryColumn('uuid')
  // id: string;

  // @BeforeInsert()
  // generateId() {
  //   this.id = uuidv4();
  // }

  @ManyToOne(() => Project, (project) => project.comments, {
    onDelete: 'CASCADE',
  })
  project: Project;

  @ManyToOne(() => Staff, { eager: true, onDelete: 'CASCADE' })
  staff: Staff;

  @Column({ type: 'text' })
  text: string;

  @CreateDateColumn()
  createdAt: Date;
}
