import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { Admin } from 'src/admin/entities/admin.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('admin_product_demos')
export class Adminproductdemo {
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

  @Column({ nullable: true })
  nameOfProduct: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('text', { nullable: true })
  howItWorks: string;

  // Array of video URLs (strings)
  @Column('text', { array: true, nullable: true })
  videos: string[];

  // Admin who created this demo
  @ManyToOne(() => Admin, { eager: true })
  @JoinColumn({ name: 'createdBy' })
  createdBy: Admin;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
