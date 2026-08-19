// src/notification-settings/entities/notification-settings.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

@Entity('notification_settings')
export class NotificationSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** One row per staff member */
  @OneToOne(() => Staff, { onDelete: 'CASCADE' })
  @JoinColumn()
  staff: Staff;

  /** FK column stored for fast lookups */
  @Column({ unique: true })
  staffId: number;

  // ── Toggle columns ────────────────────────────────────────────────────────

  /**
   * Receive notifications via email.
   * Guards: staffLoginMail, and all non-critical emails in MailService.
   */
  @Column({ default: true })
  emailNotifications: boolean;

  /**
   * Get notified about project changes.
   * Guards: PROJECT_TAG, PROJECT_UPDATE, ASSIGNMENT, COMMENT, STATUS_CHANGE
   */
  @Column({ default: true })
  projectUpdates: boolean;

  /**
   * Reminders for upcoming deadlines.
   * Guards: Task_ASSIGNMENT, Task_COMMENT, Task_UPDATE, DEADLINE
   */
  @Column({ default: true })
  taskReminders: boolean;

  /**
   * Birthdays, anniversaries, and new hires.
   * Guards: Announcement, NEW_PRODUCT, DEMO
   */
  @Column({ default: true })
  celebrationAlerts: boolean;

  /**
   * Receive weekly productivity summary.
   * Defaults to FALSE matching the UI screenshot toggle state.
   */
  @Column({ default: false })
  weeklyReport: boolean;

  @Column({ default: true })
  pushNotifications: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
