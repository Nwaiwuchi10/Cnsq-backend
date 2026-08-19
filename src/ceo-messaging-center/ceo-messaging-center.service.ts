import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateCeoMessagingCenterDto } from './dto/create-ceo-messaging-center.dto';
import { UpdateCeoMessagingCenterDto } from './dto/update-ceo-messaging-center.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CeoMessagingCenter } from './entities/ceo-messaging-center.entity';
import { In, Repository } from 'typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { NotificationService } from 'src/notification/notification.service';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { NotificationType } from 'src/notification/entities/notification.entity';
import { CeoMessagingCenterMailService } from './service/ceo-messaging-center-mail.service';
import * as webpush from 'web-push';

import { CeoMessagingCenterRead } from './entities/ceo-messaging-center-read.entity';
import { MemberActivityService } from 'src/member-activity/member-activity.service';
import { Request } from 'express';

webpush.setVapidDetails(
  `mailto:${process.env.ADMIN_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);
@Injectable()
export class CeoMessagingCenterService {
  constructor(
    @InjectRepository(CeoMessagingCenter)
    private readonly messageRepo: Repository<CeoMessagingCenter>,
    @InjectRepository(Staff) private staffRepo: Repository<Staff>,
    @InjectRepository(CeoMessagingCenterRead)
    private readonly readRepo: Repository<CeoMessagingCenterRead>,
    private readonly mailService: CeoMessagingCenterMailService,
    private readonly notificationService: NotificationService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly activityService: MemberActivityService,
  ) { }

  async create(
    dto: CreateCeoMessagingCenterDto,
    staffId: number,
    files: Express.Multer.File[],
  ): Promise<CeoMessagingCenter> {
    const sender = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!sender) throw new NotFoundException('Staff not found');

    if (!sender.isCeo) {
      throw new ForbiddenException(
        'Only staff designated as CEO can send these messages.',
      );
    }

    const attachmentUrls: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const s3File = file as Express.Multer.File & { location: string };
        attachmentUrls.push(s3File.location);
      }
    }

    let recipients: Staff[] = [];
    if (dto.isAllStaff !== false) {
      recipients = await this.staffRepo.find({
        where: { id: In(await this.getAllStaffIdsExcept(sender.id)) },
      });
    } else if (dto.recipientIds && dto.recipientIds.length > 0) {
      recipients = await this.staffRepo.find({
        where: { id: In(dto.recipientIds) },
      });
    }

    const message = this.messageRepo.create({
      title: dto.title,
      description: dto.description,
      isAllStaff: dto.isAllStaff ?? true,
      attachments: attachmentUrls,
      sender: sender,
      recipients: recipients,
    });

    const saved = await this.messageRepo.save(message);

    // Initial Broadcast
    const notifyList = [...recipients];
    if (!notifyList.some((r) => r.id === sender.id)) {
      notifyList.push(sender);
    }

    await this.mailService.sendBroadcastEmail(sender, notifyList, {
      title: saved.title,
      description: saved.description,
      attachments: attachmentUrls,
    });
    await this.notifyStaff(notifyList, saved);

    return saved;
  }

  async update(
    id: string,
    dto: UpdateCeoMessagingCenterDto,
    staffId: number,
    files?: Express.Multer.File[],
  ): Promise<CeoMessagingCenter> {
    const message = await this.messageRepo.findOne({
      where: { id },
      relations: ['sender', 'recipients'],
    });
    if (!message) throw new NotFoundException('Message not found');

    if (message.sender.id !== staffId) {
      throw new ForbiddenException('You can only update your own messages');
    }

    if (dto.title) message.title = dto.title;
    if (dto.description) message.description = dto.description;

    if (dto.isAllStaff !== undefined) {
      message.isAllStaff = dto.isAllStaff;
      if (dto.isAllStaff) {
        message.recipients = await this.staffRepo.find({
          where: { id: In(await this.getAllStaffIdsExcept(staffId)) },
        });
      }
    }

    if (dto.recipientIds) {
      message.recipients = await this.staffRepo.find({
        where: { id: In(dto.recipientIds) },
      });
    }

    if (files && files.length > 0) {
      const newUrls: string[] = [];
      for (const file of files) {
        const s3File = file as Express.Multer.File & { location: string };
        newUrls.push(s3File.location);
      }
      message.attachments = [...(message.attachments || []), ...newUrls];
    }

    const saved = await this.messageRepo.save(message);

    // Notify about update
    const notifyList = [...message.recipients];
    const messageSender = message.sender;
    if (messageSender && !notifyList.some((r) => r.id === messageSender.id)) {
      notifyList.push(messageSender);
    }
    await this.notifyStaff(notifyList, saved, true);

    return saved;
  }

  private async getAllStaffIdsExcept(senderId: number): Promise<number[]> {
    const allStaff = await this.staffRepo.find({ select: ['id'] });
    return allStaff.map((s) => s.id).filter((id) => id !== senderId);
  }

  private async notifyStaff(
    recipients: Staff[],
    message: CeoMessagingCenter,
    isUpdate = false,
  ) {
    const title = isUpdate
      ? `Updated Important Message from CEO: ${message.title}`
      : `Important Message from the CEO: ${message.title}`;
    const body = `You have an important message from the CEO. Log in to CNSQ portal to view details under Announcements.`;

    // Internal Notifications
    await this.notificationService.createNotificationsForStaffs(
      recipients,
      NotificationType.CEO_MESSAGE,
      title,
      body,
      undefined,
      undefined,
      undefined,
      undefined,
      message.id,
    );

    // Push Notifications
    for (const recipient of recipients) {
      await this.pushNotificationService.sendNotification(recipient.id, {
        title: title,
        body: body,
        url: '/notifications',
        type: 'ceo_message',
      });
    }
  }

  async findMyMessages(staffId: number): Promise<CeoMessagingCenter[]> {
    return this.messageRepo.find({
      where: { sender: { id: staffId } },
      relations: ['sender', 'recipients'],
      order: { createdAt: 'DESC' },
    });
  }

  async findAll(): Promise<CeoMessagingCenter[]> {
    return this.messageRepo.find({
      relations: ['sender', 'recipients'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<CeoMessagingCenter> {
    const msg = await this.messageRepo.findOne({
      where: { id },
      relations: ['sender', 'recipients'],
    });
    if (!msg) throw new NotFoundException('Message not found');
    return msg;
  }

  async remove(id: string): Promise<void> {
    const msg = await this.findOne(id);
    await this.messageRepo.remove(msg);
  }

  async markAsRead(
    messageId: string,
    staffId: number,
    req?: Request,
  ): Promise<{ message: string }> {
    const ceoMessage = await this.messageRepo.findOne({
      where: { id: messageId },
    });

    if (!ceoMessage) {
      throw new NotFoundException('CEO Message not found');
    }

    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // Prevent duplicate reads
    const alreadyRead = await this.readRepo.findOne({
      where: {
        ceoMessage: { id: messageId },
        staff: { id: staffId },
      },
    });

    if (alreadyRead) {
      return { message: 'Message already marked as read' };
    }

    const read = this.readRepo.create({
      ceoMessage,
      staff,
    });

    await this.readRepo.save(read);

    // Log Activity
    await this.activityService.logActivity(
      staffId,
      `Read CEO Message: ${ceoMessage.title}`,
      'Success',
      req,
      messageId,
    );

    return { message: 'Message marked as read' };
  }

  async getReaders(messageId: string) {
    const ceoMessage = await this.messageRepo.findOne({
      where: { id: messageId },
    });

    if (!ceoMessage) {
      throw new NotFoundException('CEO Message not found');
    }

    return this.readRepo.find({
      where: { ceoMessage: { id: messageId } },
      relations: ['staff'],
      order: { readAt: 'DESC' },
    });
  }

  async getReadStats(messageId: string) {
    const ceoMessage = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: ['recipients'],
    });

    if (!ceoMessage) {
      throw new NotFoundException('CEO Message not found');
    }

    const readCount = await this.readRepo.count({
      where: {
        ceoMessage: { id: messageId },
      },
    });

    const totalStaff = ceoMessage.isAllStaff
      ? (await this.staffRepo.count()) - 1 // Exclude sender
      : ceoMessage.recipients.length;

    const unreadCount = Math.max(0, totalStaff - readCount);

    return {
      messageId,
      totalStaff,
      readCount,
      unreadCount,
    };
  }
}
