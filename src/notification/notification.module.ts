// src/notification/notification.module.ts
import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationSettingsModule } from 'src/notification-settings/notification-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    NotificationSettingsModule, // provides NotificationSettingsService
  ],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
