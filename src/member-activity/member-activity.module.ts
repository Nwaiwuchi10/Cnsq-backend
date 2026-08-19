import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberActivity } from './entities/member-activity.entity';
import { MemberActivityService } from './member-activity.service';
import { MemberActivityController } from './member-activity.controller';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { Admin } from '../admin/entities/admin.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([MemberActivity, Staff, Admin])],
  providers: [MemberActivityService],
  controllers: [MemberActivityController],
  exports: [MemberActivityService],
})
export class MemberActivityModule {}
