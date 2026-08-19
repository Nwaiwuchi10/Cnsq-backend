export class StaffRegister {}
// src/staff/entities/staff.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Unique,
  OneToOne,
  JoinColumn,
  ManyToOne,
  BeforeInsert,
  BeforeUpdate,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  PrimaryColumn,
  DeleteDateColumn,
} from 'typeorm';
// import { StaffAddress } from './staff-address.entity';
import { StaffEmployment } from './staff-employment.entity';

import * as bcrypt from 'bcryptjs';
import { StaffAddress } from './staf-adress.entity';
import { Role } from 'src/roles/entities/role.entity';
// import { Department } from './department.entity';
import { v4 as uuidv4 } from 'uuid';

export enum Gender {
  MALE = 'Male',
  FEMALE = 'Female',
  OTHER = 'Other',
}

export enum MaritalStatus {
  SINGLE = 'Single',
  MARRIED = 'Married',
  DIVORCED = 'Divorced',
  WIDOWED = 'Widowed',
}

@Entity('staff')
@Unique(['email'])
@Unique(['phone'])
export class Staff {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    type: 'uuid',
    unique: true,
    nullable: false,
  })
  uuid: string;

  @BeforeInsert()
  generateUuid() {
    if (!this.uuid) {
      this.uuid = uuidv4(); // generate safely in Node.js
    }
  }

  // @Column({
  //   type: 'uuid',
  //   unique: true,
  //   default: () => 'gen_random_uuid()', // auto-generates in Postgres
  // })
  // uuid: string;

  // @BeforeInsert()
  // generateUuid() {
  //   if (!this.uuid) {
  //     this.uuid = uuidv4();
  //   }
  // }

  // === Personal Details ===
  @Column({ length: 80 })
  firstName: string;

  @Column({ length: 80 })
  lastName: string;

  @Column({ length: 2000, nullable: true })
  description: string;

  @Column('text', { array: true, nullable: true })
  hobbies: string[];

  @Column({ type: 'date', nullable: true })
  dateOfBirth: string;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Column({ type: 'enum', enum: MaritalStatus, nullable: true })
  maritalStatus?: MaritalStatus;

  @Column({ length: 180 })
  email: string;

  @Column({ length: 30 })
  phone: string;

  @Column({ nullable: true })
  password: string;

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (!this.password) {
      // set default if not provided
      this.password = '12345';
    }

    // hash only if not already hashed
    if (!this.password.startsWith('$2b$')) {
      // bcrypt hashes start with $2b$
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
  }

  @Column({ nullable: true })
  photoUrl?: string;

  // === Embedded Relations ===
  @OneToOne(() => StaffAddress, { cascade: true, eager: true })
  @JoinColumn()
  address: StaffAddress;

  @OneToOne(() => StaffEmployment, { cascade: true, eager: true })
  @JoinColumn()
  employment: StaffEmployment;

  @ManyToMany(() => Role, (role) => role.staff, { eager: true })
  @JoinTable({ name: 'staff_roles' })
  roles: Role[];

  @Column({ nullable: true })
  resetToken?: string;

  @Column({ nullable: true })
  resetTokenExpires?: Date;

  @Column({ nullable: true })
  registrationToken?: string;

  @Column({ nullable: true })
  registrationTokenExpires?: Date;

  @Column({ default: false })
  isRegistered: boolean;

  @Column({ nullable: true })
  lastIpAddress?: string;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;

  @Column({ default: false })
  isCeo: boolean;

  @Column({ default: false })
  isOnline: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
