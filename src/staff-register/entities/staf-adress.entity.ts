// src/staff/entities/staff-address.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { Staff } from './staff-register.entity';
import { v4 as uuidv4 } from 'uuid';
// import { Staff } from './staff.entity';

@Entity('staff_addresses')
export class StaffAddress {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 80 })
  city: string;

  @Column({ length: 80 })
  state: string;

  @Column({ length: 80 })
  country: string;

  @Column({ length: 20, nullable: true })
  postalCode?: string;
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
