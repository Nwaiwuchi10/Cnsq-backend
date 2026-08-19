import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateMessageCeoDto } from './dto/create-message-ceo.dto';
import { UpdateMessageCeoDto } from './dto/update-message-ceo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { MessageCeo } from './entities/message-ceo.entity';
import { Repository } from 'typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { MessageCeoMailService } from './service/mail.service';
import { ReplyMessageCeoDto } from './dto/reply-message-ceo.dto';
import { NotificationService } from 'src/notification/notification.service';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { NotificationType } from 'src/notification/entities/notification.entity';

@Injectable()
export class MessageCeoService {
  constructor(
    @InjectRepository(MessageCeo)
    private readonly messageRepo: Repository<MessageCeo>,
    @InjectRepository(Staff) private staffRepo: Repository<Staff>,

    private readonly mailService: MessageCeoMailService,
    private readonly notificationService: NotificationService,
    private readonly pushNotificationService: PushNotificationService,
  ) { }
  async create(
    dto: CreateMessageCeoDto,
    staffId: number,
    file?: Express.Multer.File,
  ): Promise<MessageCeo> {
    const staff = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff not found');

    // handle attachment URL if file exists
    if (file) {
      const s3File = file as Express.Multer.File & { location: string };
      if (s3File.location) {
        dto.attachments = [s3File.location];
      } else {
        throw new BadRequestException(
          'File upload to S3 failed: location missing',
        );
      }
    }

    const message = this.messageRepo.create({
      ...dto,
      sender: staff,
    });

    const saved = await this.messageRepo.save(message);

    // Send mail with attachment link(s)
    await this.mailService.sendEmailToCEO(staff, dto);

    return saved;
  }
  async findMyMessages(staffId: number): Promise<MessageCeo[]> {
    return this.messageRepo.find({
      where: { sender: { id: staffId } },
      relations: ['sender', 'replier'],
      order: { createdAt: 'DESC' },
    });
  }

  async getMessagesToCeo(ceoId: number): Promise<MessageCeo[]> {
    const ceo = await this.staffRepo.findOne({ where: { id: ceoId } });
    if (!ceo || !ceo.isCeo) {
      throw new ForbiddenException(
        'Only staff designated as CEO can view these messages',
      );
    }
    return this.messageRepo.find({
      relations: ['sender', 'replier'],
      order: { createdAt: 'DESC' },
    });
  }
  async findAll(): Promise<MessageCeo[]> {
    return this.messageRepo.find({
      relations: ['sender', 'replier'],
    });
  }

  async findOne(id: string): Promise<MessageCeo> {
    const message = await this.messageRepo.findOne({
      where: { id },
      relations: ['sender', 'replier'],

    });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async update(id: string, updateMessageCeoDto: UpdateMessageCeoDto): Promise<MessageCeo> {
    const message = await this.findOne(id);
    Object.assign(message, updateMessageCeoDto);
    return this.messageRepo.save(message);
  }

  async remove(id: string): Promise<void> {
    const message = await this.findOne(id);
    await this.messageRepo.remove(message);
  }

  async replyToMessage(
    id: string,
    dto: ReplyMessageCeoDto,
    ceoId: number,
    files: Express.Multer.File[],
  ) {
    const ceo = await this.staffRepo.findOne({ where: { id: ceoId } });
    if (!ceo || !ceo.isCeo) {
      throw new ForbiddenException(
        'Only staff designated as CEO can reply to messages',
      );
    }

    const message = await this.messageRepo.findOne({
      where: { id },
      relations: ['sender'],
    });
    if (!message) throw new NotFoundException('Original message not found');

    // Handle multiple file uploads
    const replyAttachments: string[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const s3File = file as Express.Multer.File & { location: string };
        if (s3File.location) {
          replyAttachments.push(s3File.location);
        }
      }
    }

    message.replyContent = dto.content;
    message.replyAttachments = replyAttachments;
    message.repliedAt = new Date();
    message.replier = ceo;

    const saved = await this.messageRepo.save(message);

    // 1. Notify Original Sender via Email
    await this.mailService.sendCeoReplyToStaff(
      message.sender,
      dto.content,
      message.subject,
      ceo,
      replyAttachments,
    );

    // 2. Internal Notification
    await this.notificationService.createNotificationForStaff(
      message.sender,
      NotificationType.CEO_REPLY,
      'CEO Response Received',
      `The CEO has replied to your message: "${message.subject}"`,
    );

    // 3. Push Notification
    await this.pushNotificationService.sendNotification(message.sender.id, {
      title: 'CEO Response Received',
      body: `Review the response to your message: "${message.subject}"`,
      url: '/notifications',
      type: 'ceo_reply',
    });

    return saved;
  }
}
