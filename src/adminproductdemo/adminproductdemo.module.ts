import { Module } from '@nestjs/common';
import { AdminproductdemoService } from './adminproductdemo.service';
import { AdminproductdemoController } from './adminproductdemo.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from 'src/admin/entities/admin.entity';
import { Adminproductdemo } from './entities/adminproductdemo.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Notification } from 'src/notification/entities/notification.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { PushNotification } from 'src/push-notification/entities/push-notification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Adminproductdemo,
      Admin,
      Staff,
      Notification,
      PushNotification,
    ]),
    NotificationModule,
  ],
  controllers: [AdminproductdemoController],
  providers: [AdminproductdemoService],
})
export class AdminproductdemoModule {}
