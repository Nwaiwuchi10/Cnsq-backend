// src/announcements/entities/announcement-read.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Announcement } from './announcement.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

@Entity('announcement_reads')
@Unique(['announcement', 'staff'])
export class AnnouncementRead {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Announcement, (a) => a.reads, { onDelete: 'CASCADE' })
  announcement: Announcement;

  @ManyToOne(() => Staff, { onDelete: 'CASCADE' })
  staff: Staff;
  // @ManyToOne(() => Staff, {
  //   // eager: true,
  //   onDelete: 'CASCADE',
  // })
  // staff: Staff;

  @CreateDateColumn()
  readAt: Date;
}
