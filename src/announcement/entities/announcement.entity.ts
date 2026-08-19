import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  ManyToMany,
  JoinTable,
  PrimaryColumn,
  BeforeInsert,
  OneToMany,
} from 'typeorm';
import { Admin } from 'src/admin/entities/admin.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { v4 as uuidv4 } from 'uuid';
import { AnnouncementRead } from './announcementread.entity';

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn()
  id: number;



  @Column()
  title: string;

  @Column('text')
  description: string;

 

  // Admin who created this demo
  @ManyToOne(() => Admin, { eager: true })
  @JoinColumn({ name: 'createdBy' })
  createdBy: Admin;

  //  Selected staffs who should receive the announcement
  @ManyToMany(() => Staff, { eager: true })
  @JoinTable({
    name: 'announcement_staffs',
    joinColumn: { name: 'announcement_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'staff_id', referencedColumnName: 'id' },
  })
  selectedStaffs: Staff[];

  @Column('simple-array', { nullable: true })
  fileUrls: string[];

  @OneToMany(() => AnnouncementRead, (read) => read.announcement)
  reads: AnnouncementRead[];
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
