import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('departments')
export class Department {
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
  nameAbrv: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
