import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Notification, NotificationType } from './entities/notification.entity';
import { Project } from 'src/projects/entities/project.entity';
import { Task } from 'src/task/entities/task.entity';
import { Announcement } from 'src/announcement/entities/announcement.entity';
import { Adminproductdemo } from 'src/adminproductdemo/entities/adminproductdemo.entity';
import {
  NotificationSettingsService,
  NotificationSettingKey,
} from 'src/notification-settings/notification-settings.service';

/**
 * Maps each NotificationType to the corresponding preference key.
 * This is the single source of truth for which toggle gates which event.
 */
const TYPE_TO_SETTING: Partial<Record<NotificationType, NotificationSettingKey>> = {
  // ── Project-related ────────────────────────────────────────────────────────
  [NotificationType.PROJECT_TAG]:    'projectUpdates',
  [NotificationType.PROJECT_UPDATE]: 'projectUpdates',
  [NotificationType.ASSIGNMENT]:     'projectUpdates',
  [NotificationType.COMMENT]:        'projectUpdates',
  [NotificationType.STATUS_CHANGE]:  'projectUpdates',

  // ── Task-related ────────────────────────────────────────────────────────────
  [NotificationType.Task_ASSIGNMENT]: 'taskReminders',
  [NotificationType.Task_COMMENT]:    'taskReminders',
  [NotificationType.Task_UPDATE]:     'taskReminders',
  [NotificationType.DEADLINE]:        'taskReminders',

  // ── Celebration / Announcement ─────────────────────────────────────────────
  [NotificationType.Announcement]: 'celebrationAlerts',
  [NotificationType.NEW_PRODUCT]:  'celebrationAlerts',
  [NotificationType.DEMO]:         'celebrationAlerts',
  [NotificationType.CEO_MESSAGE]:  'celebrationAlerts',
};

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly notificationSettingsService: NotificationSettingsService,
  ) {}

  /** Create one notification — skipped if the recipient has disabled the corresponding toggle */
  async createNotificationForStaff(
    recipient: Staff,
    type: NotificationType,
    title: string,
    message?: string,
    relatedProject?: Project,
    relatedTask?: Task,
    relatedAnnouncement?: Announcement,
    relatedProductDemo?: Adminproductdemo,
    relatedCeoMessageId?: string,
    relatedPipelineIdeaId?: string,
  ): Promise<Notification | null> {
    // ── Check preference ───────────────────────────────────────────────────────
    const settingKey = TYPE_TO_SETTING[type];
    if (settingKey) {
      const allowed = await this.notificationSettingsService.isAllowed(
        recipient.id,
        settingKey,
      );
      if (!allowed) {
        // Staff has disabled this notification channel — silently skip
        return null;
      }
    }

    const notification = this.notificationRepo.create({
      recipient,
      type,
      title,
      message,
      relatedProject,
      relatedAnnouncement,
      relatedTask,
      relatedProductDemo,
      relatedCeoMessageId,
      relatedPipelineIdeaId,
      isRead: false,
    });

    return await this.notificationRepo.save(notification);
  }

  /** Create many notifications — filters out recipients who have disabled the toggle */
  async createNotificationsForStaffs(
    recipients: Staff[],
    type: NotificationType,
    title: string,
    message?: string,
    relatedProject?: Project,
    relatedTask?: Task,
    relatedAnnouncement?: Announcement,
    relatedProductDemo?: Adminproductdemo,
    relatedCeoMessageId?: string,
    relatedPipelineIdeaId?: string,
  ): Promise<Notification[]> {
    // ── Filter by preference ───────────────────────────────────────────────────
    const settingKey = TYPE_TO_SETTING[type];
    let eligibleRecipients = recipients;

    if (settingKey) {
      const checks = await Promise.all(
        recipients.map(async (r) => ({
          staff: r,
          allowed: await this.notificationSettingsService.isAllowed(
            r.id,
            settingKey,
          ),
        })),
      );
      eligibleRecipients = checks
        .filter((c) => c.allowed)
        .map((c) => c.staff);
    }

    if (eligibleRecipients.length === 0) return [];

    const entities = eligibleRecipients.map((recipient) =>
      this.notificationRepo.create({
        recipient,
        type,
        title,
        message,
        relatedProject,
        relatedAnnouncement,
        relatedProductDemo,
        relatedTask,
        relatedCeoMessageId,
        relatedPipelineIdeaId,
        isRead: false,
      }),
    );

    return await this.notificationRepo.save(entities);
  }

  /** Mark a notification as read/unread */
  async markAsRead(
    notificationId: number,
    isRead = true,
  ): Promise<Notification> {
    const notification = await this.notificationRepo.findOneBy({
      id: notificationId,
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = isRead;
    return await this.notificationRepo.save(notification);
  }

  /** Fetch notifications for a staff (simple) */
  async findForRecipient(
    recipientId: number,
    onlyUnread = false,
  ): Promise<Notification[]> {
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.relatedProject', 'project')
      .leftJoinAndSelect('n.triggeredByStaff', 'triggeredByStaff')
      .where('n.recipient = :recipientId', { recipientId });

    if (onlyUnread) {
      qb.andWhere('n.isRead = false');
    }

    qb.orderBy('n.createdAt', 'DESC');

    return await qb.getMany();
  }

  create(createNotificationDto: CreateNotificationDto) {
    return 'This action adds a new notification';
  }

  findAll() {
    const notifications = this.notificationRepo.find({
      relations: [
        'recipient',
        'relatedProductDemo',
        'relatedAnnouncement',
        'triggeredByStaff',
        'triggeredByAdmin',
        'relatedProject',
        'relatedTask',
      ],
      order: { createdAt: 'DESC' },
    });
    return notifications;
  }

  findOne(id: number) {
    const notification = this.notificationRepo.findOne({
      where: { id },
      relations: [
        'recipient',
        'relatedProductDemo',
        'relatedAnnouncement',
        'triggeredByStaff',
        'triggeredByAdmin',
        'relatedProject',
        'relatedTask',
      ],
    });
    return notification;
  }

  async getUnreadCount(recipientId: number): Promise<number> {
    return this.notificationRepo.count({
      where: {
        recipient: { id: recipientId },
        isRead: false,
      },
    });
  }

  async getReadCount(recipientId: number): Promise<number> {
    return this.notificationRepo.count({
      where: {
        recipient: { id: recipientId },
        isRead: true,
      },
    });
  }

  async remove(id: number, staffId: number): Promise<{ message: string }> {
    const notification = await this.notificationRepo.findOne({
      where: { id, recipient: { id: staffId } },
      relations: ['recipient'],
    });

    if (!notification) {
      throw new NotFoundException('Notification not found or not authorized');
    }

    if (!notification.isRead) {
      throw new BadRequestException('You can only delete read notifications');
    }

    await this.notificationRepo.remove(notification);

    return {
      message: 'Notification deleted successfully',
    };
  }

  update(id: number, updateNotificationDto: UpdateNotificationDto) {
    return `This action updates a #${id} notification`;
  }

  async getProductDemoAnnouncementCounts(recipientId: number) {
    const types = [
      NotificationType.NEW_PRODUCT,
      NotificationType.DEMO,
      NotificationType.Announcement,
      NotificationType.CEO_MESSAGE,
    ];

    const unreadCount = await this.notificationRepo.count({
      where: {
        recipient: { id: recipientId },
        isRead: false,
        type: In(types),
      },
    });

    const readCount = await this.notificationRepo.count({
      where: {
        recipient: { id: recipientId },
        isRead: true,
        type: In(types),
      },
    });

    return { unreadCount, readCount, total: unreadCount + readCount };
  }

  async findAnnouncementNoticesForRecipient(
    recipientId: number,
    onlyUnread = false,
  ): Promise<Notification[]> {
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.triggeredByStaff', 'triggeredByStaff')
      .leftJoinAndSelect('n.relatedProductDemo', 'relatedProductDemo')
      .leftJoinAndSelect('n.relatedAnnouncement', 'relatedAnnouncement')
      .leftJoinAndSelect('n.triggeredByAdmin', 'triggeredByAdmin')
      .where('n.recipient = :recipientId', { recipientId })
      .andWhere('n.type IN (:...types)', {
        types: [
          NotificationType.NEW_PRODUCT,
          NotificationType.DEMO,
          NotificationType.Announcement,
          NotificationType.CEO_MESSAGE,
        ],
      });

    if (onlyUnread) {
      qb.andWhere('n.isRead = false');
    }

    qb.orderBy('n.createdAt', 'DESC');

    return await qb.getMany();
  }
}
