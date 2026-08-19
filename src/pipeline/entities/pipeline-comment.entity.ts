import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Staff } from '../../staff-register/entities/staff-register.entity';
import { PipelineIdea } from './pipeline-idea.entity';
import { PipelineCommentReaction } from './pipeline-comment-reaction.entity';

@Entity('pipeline_comments')
export class PipelineComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PipelineIdea, idea => idea.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ideaId' })
  idea: PipelineIdea;

  @ManyToOne(() => Staff, { eager: true })
  @JoinColumn({ name: 'authorId' })
  author: Staff;

  @ManyToOne(() => PipelineComment, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parentCommentId' })
  parentComment: PipelineComment;

  @Column('text')
  content: string;

  @Column('text', { array: true, nullable: true })
  attachments: string[];

  @OneToMany(() => PipelineCommentReaction, reaction => reaction.comment, { cascade: true })
  reactions: PipelineCommentReaction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
