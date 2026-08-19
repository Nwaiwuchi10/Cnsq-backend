import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Staff } from '../../staff-register/entities/staff-register.entity';
import { Department } from '../../departments/entities/department.entity';
import { PipelineComment } from './pipeline-comment.entity';
import { PipelineReaction } from './pipeline-reaction.entity';

@Entity('pipeline_ideas')
export class PipelineIdea {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  pipeRef: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @ManyToOne(() => Staff, { eager: true })
  @JoinColumn({ name: 'authorId' })
  author: Staff;

  @ManyToOne(() => Department, { nullable: true, eager: true })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column('text', { array: true, nullable: true })
  attachments: string[];

  @OneToMany(() => PipelineReaction, reaction => reaction.idea, { cascade: true })
  reactions: PipelineReaction[];

  @OneToMany(() => PipelineComment, comment => comment.idea, { cascade: true })
  comments: PipelineComment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
