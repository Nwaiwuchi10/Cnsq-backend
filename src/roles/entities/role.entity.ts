// src/roles/entities/role.entity.ts
import { Permission } from 'src/permissions/entities/permission.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  PrimaryColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('roles')
export class Role {
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

  @Column({ unique: true })
  name: string; // e.g. HR, Project Manager

  @ManyToMany(() => Permission, { eager: true })
  @JoinTable({ name: 'role_permissions' })
  permissions: Permission[];

  @ManyToMany(() => Staff, (staff) => staff.roles)
  staff: Staff[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
