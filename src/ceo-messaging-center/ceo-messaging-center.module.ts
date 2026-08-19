import { Module } from '@nestjs/common';
import { CeoMessagingCenterService } from './ceo-messaging-center.service';
import { CeoMessagingCenterController } from './ceo-messaging-center.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CeoMessagingCenter } from './entities/ceo-messaging-center.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { PushNotificationModule } from 'src/push-notification/push-notification.module';
import { CeoMessagingCenterMailService } from './service/ceo-messaging-center-mail.service';

import { CeoMessagingCenterRead } from './entities/ceo-messaging-center-read.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CeoMessagingCenter, Staff, CeoMessagingCenterRead]),
    NotificationModule,
    PushNotificationModule,
  ],
  controllers: [CeoMessagingCenterController],
  providers: [CeoMessagingCenterService, CeoMessagingCenterMailService],
})
export class CeoMessagingCenterModule {}
