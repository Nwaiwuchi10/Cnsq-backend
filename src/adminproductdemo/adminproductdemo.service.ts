import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateAdminproductdemoDto } from './dto/create-adminproductdemo.dto';
import { UpdateAdminproductdemoDto } from './dto/update-adminproductdemo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Admin } from 'src/admin/entities/admin.entity';
import { ILike, Repository } from 'typeorm';
import { Adminproductdemo } from './entities/adminproductdemo.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationType } from 'src/notification/entities/notification.entity';
import { GetAdminProductDemosDto } from './dto/get-adminproductdemo.dto';
import * as webpush from 'web-push';
import { PushNotification } from 'src/push-notification/entities/push-notification.entity';

webpush.setVapidDetails(
  `mailto:${process.env.ADMIN_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);
@Injectable()
export class AdminproductdemoService {
  constructor(
    @InjectRepository(Adminproductdemo)
    private readonly demoRepo: Repository<Adminproductdemo>,
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,

    @InjectRepository(PushNotification)
    private readonly pushRepo: Repository<PushNotification>,

    private readonly notificationService: NotificationService,
  ) {}
  async create(
    dto: CreateAdminproductdemoDto,
    userId: number,
    file?: Express.Multer.File,
  ): Promise<Adminproductdemo> {
    const admin = await this.adminRepo.findOne({ where: { id: userId } });
    if (!admin) {
      throw new NotFoundException(
        'Admin not found, only Admins can create demos',
      );
    }

    // Handle uploaded video file (S3)
    if (file) {
      const s3File = file as Express.Multer.File & { location?: string };
      if (s3File.location) {
        // Add uploaded video URL to array
        dto.videos = dto.videos
          ? [...dto.videos, s3File.location]
          : [s3File.location];
      } else {
        throw new BadRequestException(
          'File upload to S3 failed: location missing',
        );
      }
    }

    const demo = this.demoRepo.create({
      nameOfProduct: dto.nameOfProduct,
      description: dto.description,
      howItWorks: dto.howItWorks,
      videos: dto.videos || [],
      createdBy: admin,
    });

    // return this.demoRepo.save(demo);

    const savedDemo = await this.demoRepo.save(demo);
    const passedSavedDemo = savedDemo;

    // Notify all staff members
    const staffs = await this.staffRepo.find();
    if (staffs.length > 0) {
      await this.notificationService.createNotificationsForStaffs(
        staffs,
        NotificationType.DEMO,
        `New Product Demo: ${dto.nameOfProduct}`,
        `A new product demo titled ${dto.nameOfProduct} has been uploaded by ${admin.id ? 'Admin' : 'an administrator'}.`,
        undefined, // relatedProject
        undefined, // relatedTask
        undefined, // relatedAnnouncement
        passedSavedDemo,
      );
    }
    // 🚀 NEW: Web Push Notification Integration
    try {
      // Get all browser subscriptions
      const subscriptions = await this.pushRepo.find();

      // Prepare push notification payload
      const payload = JSON.stringify({
        title: `New Announcement on Product Demo: ${dto.nameOfProduct}`,
        body: dto.description,
        url: '/notifications',
        type: 'productdemo',
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
    return savedDemo;
  }

  findAllData(): Promise<Adminproductdemo[]> {
    return this.demoRepo.find();
  }

  async findAll(query: GetAdminProductDemosDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = query.search ? query.search.trim() : null;

    const where = search
      ? [
          { nameOfProduct: ILike(`%${search}%`) },
          { description: ILike(`%${search}%`) },
          { howItWorks: ILike(`%${search}%`) },
        ]
      : {};

    const [data, total] = await this.demoRepo.findAndCount({
      where,
      take: limit,
      skip,
      order: { createdAt: 'DESC' },
      relations: ['createdBy'],
    });

    return {
      data,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number): Promise<Adminproductdemo> {
    const demo = await this.demoRepo.findOne({ where: { id } });
    if (!demo) throw new NotFoundException('Product demo not found');
    return demo;
  }

  async updates(
    id: number,
    dto: UpdateAdminproductdemoDto,
  ): Promise<Adminproductdemo> {
    const demo = await this.findOne(id);
    Object.assign(demo, dto);
    return this.demoRepo.save(demo);
  }
  async update(
    id: number,
    dto: UpdateAdminproductdemoDto,
    file?: Express.Multer.File,
  ): Promise<Adminproductdemo> {
    const demo = await this.findOne(id);

    // If a new video file is uploaded, add it to existing array
    if (file) {
      const s3File = file as Express.Multer.File & { location?: string };
      if (s3File.location) {
        demo.videos = demo.videos
          ? [...demo.videos, s3File.location]
          : [s3File.location];
      } else {
        throw new BadRequestException(
          'File upload to S3 failed: location missing',
        );
      }
    }

    // Merge other updated fields
    Object.assign(demo, dto);

    // return this.demoRepo.save(demo);
    const updatedDemo = await this.demoRepo.save(demo);

    //  Notify all staff members about update
    const staffs = await this.staffRepo.find();
    if (staffs.length > 0) {
      await this.notificationService.createNotificationsForStaffs(
        staffs,
        NotificationType.DEMO,
        `Updated Product Demo: ${demo.nameOfProduct}`,
        `The product demo ${demo.nameOfProduct} has just been updated. Check it out for the latest information.`,
      );
    }

    return updatedDemo;
  }

  async remove(id: number): Promise<{ message: string }> {
    const demo = await this.findOne(id);
    await this.demoRepo.remove(demo);
    return {
      message: 'Product demo deleted successfully',
    };
  }
}
