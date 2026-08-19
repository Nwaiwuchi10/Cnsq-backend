// src/projects/entities/project-assignment.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  BeforeInsert,
  PrimaryColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('project_assignments')
export class ProjectAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  // @PrimaryColumn('uuid')
  // id: string;

  // @BeforeInsert()
  // generateId() {
  //   this.id = uuidv4();
  // }

  @ManyToOne(() => Project, (project) => project.assignedTo, {
    onDelete: 'CASCADE',
  })
  project: Project;

  @ManyToOne(() => Staff, { eager: true, onDelete: 'CASCADE' })
  staff: Staff;

  @Column({ type: 'varchar', length: 100 })
  role: string;
}
