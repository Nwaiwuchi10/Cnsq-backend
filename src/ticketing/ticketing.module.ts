import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketingController } from './ticketing.controller';
import { TicketingService } from './ticketing.service';
import { Ticket } from './entities/ticket.entity';
import { TicketActivity } from './entities/ticket-activity.entity';
import { Department } from 'src/departments/entities/department.entity';
import { HeadOfDepartment } from 'src/headofdepartment/entities/headofdepartment.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { PushNotificationModule } from 'src/push-notification/push-notification.module';
import { TicketingMailService } from './services/mail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketActivity,
      Department,
      HeadOfDepartment,
      Staff,
    ]),
    NotificationModule,
    PushNotificationModule,
  ],
  controllers: [TicketingController],
  providers: [TicketingService, TicketingMailService],
  exports: [TicketingService],
})
export class TicketingModule {}
