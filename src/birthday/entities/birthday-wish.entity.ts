import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { Birthday } from './birthday.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('birthday_wishes')
export class BirthdayWish {
  // @PrimaryGeneratedColumn()
  // id: number;

  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  @Column({ type: 'text' })
  message: string;
  @ManyToOne(() => Birthday, (birthday) => birthday.wishes, {
    onDelete: 'CASCADE',
  })
  birthday: Birthday;

  @ManyToOne(() => Staff, { eager: true, nullable: false, onDelete: 'CASCADE' })
  staff: Staff;

  @CreateDateColumn()
  createdAt: Date;
}
