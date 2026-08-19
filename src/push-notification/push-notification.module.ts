import { Module } from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import { PushNotificationController } from './push-notification.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushNotification } from './entities/push-notification.entity';
import { StaffRegisterModule } from 'src/staff-register/staff-register.module';

@Module({
  imports: [TypeOrmModule.forFeature([PushNotification]), StaffRegisterModule],
  controllers: [PushNotificationController],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class PushNotificationModule {}
