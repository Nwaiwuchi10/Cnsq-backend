import { Staff } from 'src/staff-register/entities/staff-register.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryColumn,
  BeforeInsert,
} from 'typeorm';
import { BirthdayWish } from './birthday-wish.entity';
import { v4 as uuidv4 } from 'uuid';
@Entity('birthdays')
export class Birthday {
  @PrimaryColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }
  // @PrimaryGeneratedColumn()
  // id: number;

  @ManyToOne(() => Staff, { eager: true, nullable: false, onDelete: 'CASCADE' })
  celebrant: Staff;

  @OneToMany(() => BirthdayWish, (wish) => wish.birthday, {
    cascade: true,
  })
  wishes: BirthdayWish[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
