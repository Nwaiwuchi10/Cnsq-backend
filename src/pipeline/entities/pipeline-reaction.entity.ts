import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Staff } from '../../staff-register/entities/staff-register.entity';
import { PipelineIdea } from './pipeline-idea.entity';

@Entity('pipeline_reactions')
export class PipelineReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PipelineIdea, idea => idea.reactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ideaId' })
  idea: PipelineIdea;

  @ManyToOne(() => Staff, { eager: true })
  @JoinColumn({ name: 'authorId' })
  author: Staff;

  @Column()
  emoji: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
