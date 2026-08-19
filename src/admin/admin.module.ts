import { Admin } from './entities/admin.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { MemberActivity } from '../member-activity/entities/member-activity.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

@Module({
  imports: [TypeOrmModule.forFeature([Admin, Staff, MemberActivity])],

  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule { }
