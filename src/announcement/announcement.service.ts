import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Announcement } from './entities/announcement.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { ILike, In, Repository } from 'typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationType } from 'src/notification/entities/notification.entity';
import { GetAnnouncementDto } from './dto/getAnnouncement.dto';
import * as webpush from 'web-push';
import { PushNotification } from 'src/push-notification/entities/push-notification.entity';
import { AnnouncementRead } from './entities/announcementread.entity';

import { Request } from 'express';
import { MemberActivityService } from 'src/member-activity/member-activity.service';

webpush.setVapidDetails(
  `mailto:${process.env.ADMIN_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);
@Injectable()
export class AnnouncementService {
  constructor(
    @InjectRepository(Announcement)
    private readonly announcementRepo: Repository<Announcement>,

    @InjectRepository(AnnouncementRead)
    private readonly announcementReadRepo: Repository<AnnouncementRead>,

    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,

    @InjectRepository(PushNotification)
    private readonly pushRepo: Repository<PushNotification>,

    private readonly notificationService: NotificationService,
    private readonly activityService: MemberActivityService,
  ) {}
  /** Create announcement and notify selected staffs */
  async create(
    dto: CreateAnnouncementDto,
    adminId: number,
  ): Promise<Announcement> {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');

    // Determine which staffs to send to
    let selectedStaffs: Staff[] = [];

    if (dto.selectedStaffIds?.length) {
      // Case 1: Specific staffs selected
      selectedStaffs = await this.staffRepo.find({
        where: { id: In(dto.selectedStaffIds) },
      });
    } else {
      // 🚀 Case 2: No staffs selected → send to all
      selectedStaffs = await this.staffRepo.find(); // fetch all staffs
    }

    const announcement = this.announcementRepo.create({
      title: dto.title,
      description: dto.description,
      createdBy: admin,
      selectedStaffs,
      fileUrls: dto.fileUrls,
    });

    const savedAnnouncement = await this.announcementRepo.save(announcement);

    //  Create notifications for recipients (your existing logic)
    if (selectedStaffs.length > 0) {
      await this.notificationService.createNotificationsForStaffs(
        selectedStaffs,
        NotificationType.Announcement,
        `New Announcement: ${dto.title}`,
        dto.description,
        undefined, // relatedProject
        undefined, // relatedTask
        savedAnnouncement, // relatedAnnouncement
      );
    }

    // 🚀 NEW: Web Push Notification Integration
    try {
      // Get all browser subscriptions
      const subscriptions = await this.pushRepo.find();

      // Prepare push notification payload
      const payload = JSON.stringify({
        title: `New Announcement: ${dto.title}`,
        body: dto.description,
        url: '/notifications',
        type: 'announcement',
        // url: `/announcement/${savedAnnouncement.id}`,
      });

      // Send push to every subscribed device
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(sub.data, payload);
        } catch (err) {
          console.error('Web Push Error:', err);
        }
      }
    } catch (err) {
      console.error('Failed to send Push Notifications:', err);
    }

    return savedAnnouncement;
  }
  async creates(
    dto: CreateAnnouncementDto,
    adminId: number,
  ): Promise<Announcement> {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');

    // Determine which staffs to send to
    let selectedStaffs: Staff[] = [];

    if (dto.selectedStaffIds?.length) {
      // Case 1: Specific staffs selected
      selectedStaffs = await this.staffRepo.find({
        where: { id: In(dto.selectedStaffIds) },
      });
    } else {
      // 🚀 Case 2: No staffs selected → send to all
      selectedStaffs = await this.staffRepo.find(); // fetch all staffs
    }

    const announcement = this.announcementRepo.create({
      title: dto.title,
      description: dto.description,
      createdBy: admin,
      selectedStaffs,
      fileUrls: dto.fileUrls,
    });

    const savedAnnouncement = await this.announcementRepo.save(announcement);

    //  Create notifications for recipients
    if (selectedStaffs.length > 0) {
      await this.notificationService.createNotificationsForStaffs(
        selectedStaffs,
        NotificationType.Announcement,
        `New Announcement: ${dto.title}`,
        dto.description,
        undefined, // relatedProject
        undefined, // relatedTask
        savedAnnouncement, // relatedAnnouncement
      );
    }

    return savedAnnouncement;
  }

  /** Get all announcements */
  async findAllData(): Promise<Announcement[]> {
    return this.announcementRepo.find({
      relations: ['createdBy', 'selectedStaffs'],
    });
  }
  /////get all with search and pagination
  async findAll(query: GetAnnouncementDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = query.search ? query.search.trim() : null;

    const where = search
      ? [{ title: ILike(`%${search}%`) }, { description: ILike(`%${search}%`) }]
      : {};

    const [data, total] = await this.announcementRepo.findAndCount({
      where,
      take: limit,
      skip,
      order: { createdAt: 'DESC' },
      relations: ['createdBy', 'selectedStaffs'],
    });

    return {
      data,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    };
  }
  /**  Get one announcement by ID */
  async findOne(id: number): Promise<Announcement> {
    const announcement = await this.announcementRepo.findOne({
      where: { id },
      relations: ['createdBy', 'selectedStaffs'],
    });
    if (!announcement) throw new NotFoundException('Announcement not found');
    return announcement;
  }

  /**  Update announcement and notify selected staffs */
  async update(id: number, dto: UpdateAnnouncementDto): Promise<Announcement> {
    const announcement = await this.findOne(id);

    let selectedStaffs: Staff[] = [];
    if (dto.selectedStaffIds?.length) {
      selectedStaffs = await this.staffRepo.find({
        where: { id: In(dto.selectedStaffIds) },
      });
      announcement.selectedStaffs = selectedStaffs;
    }

    if (dto.fileUrls) {
      announcement.fileUrls = dto.fileUrls;
    }

    Object.assign(announcement, dto);
    const updated = await this.announcementRepo.save(announcement);

    // Notify updated staffs
    if (announcement.selectedStaffs?.length) {
      await this.notificationService.createNotificationsForStaffs(
        announcement.selectedStaffs,
        NotificationType.Announcement,
        `Updated Announcement: ${announcement.title}`,
        `The announcement "${announcement.title}" has been updated.`,
      );
    }

    return updated;
  }

  /**  Delete an announcement */
  async remove(id: number): Promise<{ message: string }> {
    const announcement = await this.findOne(id);
    await this.announcementRepo.remove(announcement);
    return {
      message: 'Announcement deleted successfully',
    };
  }
  // announcement.service.ts
  async markAsRead(
    announcementId: number,
    staffId: number,
    req?: Request,
  ): Promise<{ message: string }> {
    const announcement = await this.announcementRepo.findOne({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    // ✅ Fetch staff using ID from token
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    const alreadyRead = await this.announcementReadRepo.findOne({
      where: {
        announcement: { id: announcementId },
        staff: { id: staff.id },
      },
    });

    if (alreadyRead) {
      throw new ConflictException('Announcement already marked as read');
    }

    const read = this.announcementReadRepo.create({
      announcement,
      staff,
    });

    await this.announcementReadRepo.save(read);

    // Log Activity
    await this.activityService.logActivity(
      staffId,
      `Read Announcement: ${announcement.title}`,
      'Success',
      req,
      announcementId.toString(),
    );

    return { message: 'Announcement marked as read' };
  }

  async getReaders(announcementId: number) {
    return this.announcementReadRepo.find({
      where: { announcement: { id: announcementId } },
      relations: ['staff'],
      order: { readAt: 'DESC' },
    });
  }

  async markAsReads(
    announcementId: number,
    staffId: number,
  ): Promise<{ message: string }> {
    const announcement = await this.announcementRepo.findOne({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
    });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    // Prevent duplicate reads
    const alreadyRead = await this.announcementReadRepo.findOne({
      where: {
        announcement: { id: announcementId },
        staff: { id: staffId },
      },
    });

    if (alreadyRead) {
      return { message: 'Announcement already marked as read' };
    }

    const read = this.announcementReadRepo.create({
      announcement,
      staff,
    });

    await this.announcementReadRepo.save(read);

    return { message: 'Announcement marked as read' };
  }

  // announcement.service.ts
  async markAsUnread(
    announcementId: number,
    staffId: number,
  ): Promise<{ message: string }> {
    const readRecord = await this.announcementReadRepo.findOne({
      where: {
        announcement: { id: announcementId },
        staff: { id: staffId },
      },
    });

    if (!readRecord) {
      return { message: 'Announcement already unread' };
    }

    await this.announcementReadRepo.remove(readRecord);

    return { message: 'Announcement marked as unread' };
  }
  async getReadersy(announcementId: number) {
    const announcement = await this.announcementRepo.findOne({
      where: { id: announcementId },
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    return this.announcementReadRepo
      .createQueryBuilder('read')
      .leftJoinAndSelect('read.staff', 'staff')
      .where('read.announcementId = :id', { id: announcementId })
      .orderBy('read.readAt', 'DESC')
      .getMany();
  }

  // async getReaders(announcementId: number) {
  //   const announcement = await this.announcementRepo.findOne({
  //     where: { id: announcementId },
  //   });

  //   if (!announcement) {
  //     throw new NotFoundException('Announcement not found');
  //   }

  //   return this.announcementReadRepo.find({
  //     where: {
  //       announcement: { id: announcementId },
  //     },
  //     relations: ['staff'],
  //   });
  // }

  // announcement.service.ts
  async getReadUnreadCount(announcementId: number) {
    const announcement = await this.announcementRepo.findOne({
      where: { id: announcementId },
      relations: ['selectedStaffs'],
    });

    if (!announcement) {
      throw new NotFoundException('Announcement not found');
    }

    const readCount = await this.announcementReadRepo.count({
      where: {
        announcement: { id: announcementId },
      },
    });

    const totalStaff = announcement.selectedStaffs.length;
    const unreadCount = totalStaff - readCount;

    return {
      announcementId,
      totalStaff,
      readCount,
      unreadCount,
    };
  }
}
