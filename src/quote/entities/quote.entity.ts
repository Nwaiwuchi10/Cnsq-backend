import {
  Entity,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Admin } from 'src/admin/entities/admin.entity';

@Entity('admin_quotes')
export class Quote {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }
  @Column()
  subject: string;

  @Column('text')
  description: string;

  // Array of picture or video URLs (strings)
  @Column('text', { array: true, nullable: true })
  fileUrl: string[];

  // Admin who created this demo
  @ManyToOne(() => Admin, { eager: true })
  @JoinColumn({ name: 'createdBy' })
  createdBy: Admin;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
