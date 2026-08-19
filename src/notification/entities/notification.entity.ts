// src/notifications/entities/notification.entity.ts
import { Admin } from 'src/admin/entities/admin.entity';
import { Adminproductdemo } from 'src/adminproductdemo/entities/adminproductdemo.entity';
import { Announcement } from 'src/announcement/entities/announcement.entity';
import { Project } from 'src/projects/entities/project.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Task } from 'src/task/entities/task.entity';
import { v4 as uuidv4 } from 'uuid';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  PrimaryColumn,
} from 'typeorm';

export enum NotificationType {
  PROJECT_TAG = 'project_tag',
  ASSIGNMENT = 'assignment',
  COMMENT = 'comment',
  Task_ASSIGNMENT = 'task_assignment',
  Task_COMMENT = 'task_comment',
  Task_UPDATE = 'task_update',
  STATUS_CHANGE = 'status_change',
  DEADLINE = 'deadline',
  PROJECT_UPDATE = 'project_update',
  NEW_PRODUCT = 'new_product',
  DEMO = 'demo',
  Announcement = 'announcement',
  CEO_MESSAGE = 'ceo_message',
  CEO_REPLY = 'ceo_reply',
  PIPELINE = 'pipeline',
  PIPELINE_COMMENT = 'pipeline_comment',
  PIPELINE_TAG = 'pipeline_tag',
}

@Entity('notifications')
export class Notification {
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

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ default: false })
  isRead: boolean;

  @ManyToOne(() => Staff, { eager: true, onDelete: 'CASCADE' })
  recipient: Staff;

  @ManyToOne(() => Staff, { eager: true, nullable: true })
  triggeredByStaff?: Staff;

  @ManyToOne(() => Admin, { eager: true, nullable: true })
  triggeredByAdmin?: Admin;

  @ManyToOne(() => Project, { nullable: true, onDelete: 'CASCADE' })
  relatedProject?: Project;

  @ManyToOne(() => Task, { nullable: true, onDelete: 'CASCADE' })
  relatedTask?: Task;

  @ManyToOne(() => Announcement, { nullable: true, onDelete: 'CASCADE' })
  relatedAnnouncement?: Announcement;

  @ManyToOne(() => Adminproductdemo, { nullable: true, onDelete: 'CASCADE' })
  relatedProductDemo?: Adminproductdemo;

  @Column({ nullable: true })
  relatedCeoMessageId?: string;

  @Column({ nullable: true })
  relatedPipelineIdeaId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
