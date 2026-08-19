import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Staff } from '../../staff-register/entities/staff-register.entity';

@Entity('member_activities')
export class MemberActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Staff, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'staffId' })
  staff: Staff;

  @Column()
  staffId: number;

  @Column()
  action: string;

  @Column({ type: 'varchar', nullable: true })
  deviceType: string | null;

  @Column({ type: 'varchar', nullable: true })
  browser: string | null;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ type: 'varchar', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

  @Column({ type: 'varchar', nullable: true })
  sessionDuration: string | null;

  @Column({ type: 'varchar', nullable: true })
  referenceId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
