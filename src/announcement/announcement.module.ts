import { Module } from '@nestjs/common';
import { AnnouncementService } from './announcement.service';
import { AnnouncementController } from './announcement.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './entities/announcement.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Notification } from 'src/notification/entities/notification.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { PushNotification } from 'src/push-notification/entities/push-notification.entity';
import { AnnouncementRead } from './entities/announcementread.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Announcement,
      AnnouncementRead,
      Admin,
      Staff,
      Notification,
      PushNotification,
    ]),
    NotificationModule,
  ],
  controllers: [AnnouncementController],
  providers: [AnnouncementService],
})
export class AnnouncementModule {}
