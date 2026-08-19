import { Staff } from 'src/staff-register/entities/staff-register.entity';
import {
  Entity,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  ManyToMany,
  JoinTable,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { CeoMessagingCenterRead } from './ceo-messaging-center-read.entity';

@Entity('ceo_messaging_center')
export class CeoMessagingCenter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: true })
  isAllStaff: boolean;

  // Multiple file URLs stored as a simple array (comma-separated strings in DB)
  @Column('simple-array', { nullable: true })
  attachments?: string[];

  @ManyToOne(() => Staff, (staff) => staff.id, { eager: true })
  sender: Staff;

  @ManyToMany(() => Staff)
  @JoinTable({ name: 'ceo_messaging_center_recipients' })
  recipients: Staff[];

  @OneToMany(() => CeoMessagingCenterRead, (read) => read.ceoMessage)
  reads: CeoMessagingCenterRead[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
