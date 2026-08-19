import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  UpdateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { Message } from './Message.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { v4 as uuidv4 } from 'uuid';

@Entity('thread_reads')
@Index(['message', 'user'], { unique: true })
export class ThreadRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    this.id = uuidv4();
  }

  @ManyToOne(() => Message, { onDelete: 'CASCADE' })
  message: Message;

  @ManyToOne(() => Staff, { onDelete: 'CASCADE' })
  user: Staff;

  @UpdateDateColumn()
  lastReadAt: Date;
}
