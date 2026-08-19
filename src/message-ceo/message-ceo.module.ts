import { Module } from '@nestjs/common';
import { MessageCeoService } from './message-ceo.service';
import { MessageCeoController } from './message-ceo.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageCeo } from './entities/message-ceo.entity';
import { MessageCeoMailService } from './service/mail.service';
import { StaffRegisterService } from 'src/staff-register/staff-register.service';
import {
  Staff,
  StaffRegister,
} from 'src/staff-register/entities/staff-register.entity';
import { StaffEmployment } from 'src/staff-register/entities/staff-employment.entity';
import { StaffAddress } from 'src/staff-register/entities/staf-adress.entity';
import { Role } from 'src/roles/entities/role.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { PushNotificationModule } from 'src/push-notification/push-notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessageCeo,
      StaffRegister,
      StaffEmployment,
      Staff,
      StaffAddress,
      Role,
    ]),
    NotificationModule,
    PushNotificationModule,
  ],
  controllers: [MessageCeoController],
  providers: [MessageCeoService, MessageCeoMailService],
  exports: [MessageCeoMailService],
})
export class MessageCeoModule {}
