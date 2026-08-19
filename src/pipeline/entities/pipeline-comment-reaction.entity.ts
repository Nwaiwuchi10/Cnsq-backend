import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Staff } from '../../staff-register/entities/staff-register.entity';
import { PipelineComment } from './pipeline-comment.entity';

@Entity('pipeline_comment_reactions')
export class PipelineCommentReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PipelineComment, comment => comment.reactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commentId' })
  comment: PipelineComment;

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
