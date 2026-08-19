import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveRequestService } from './leave-request.service';
import { LeaveRequestController } from './leave-request.controller';
import { LeaveRequest } from './entities/leave-request.entity';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { StaffRegisterModule } from '../staff-register/staff-register.module';
import { PushNotificationModule } from '../push-notification/push-notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveRequest, Staff]),
    StaffRegisterModule,
    PushNotificationModule,
  ],
  controllers: [LeaveRequestController],
  providers: [LeaveRequestService],
  exports: [LeaveRequestService],
})
export class LeaveRequestModule {}
