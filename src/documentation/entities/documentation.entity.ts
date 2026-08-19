import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

@Entity('documentation')
export class Documentation {
  @PrimaryGeneratedColumn('uuid')
  id: string;


  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  link?: string;

  @Column({ type: 'text', array: true, default: '{}' })
  files: string[];

  @ManyToOne(() => Staff, { eager: true, nullable: true })
  createdBy: Staff;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
