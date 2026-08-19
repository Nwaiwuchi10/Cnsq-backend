import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Entity('push_subscriptions')
@Index(['userId']) // Performance optimization for user lookups
@Index(['endpoint'], { unique: true }) // Ensure endpoint uniqueness at DB level
export class PushNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  @Column({ unique: true })
  endpoint: string;

  @Column('jsonb', { default: {} })
  data: Record<string, any>;

  @Column({ type: 'integer', nullable: false })
  userId: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true, default: null })
  updatedAt: Date;
}
