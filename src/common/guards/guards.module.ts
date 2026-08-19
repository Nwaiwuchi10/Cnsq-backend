import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { MemberActivity } from '../../member-activity/entities/member-activity.entity';
import { Staff } from '../../staff-register/entities/staff-register.entity';
import { Admin } from '../../admin/entities/admin.entity';
import { StaffAuthGuard } from '../../staff-register/guard/staff.guard';
import { UserAuthGuard } from '../../admin/guard/auth.guard';
import { StaffOrAdminAuthGuard } from '../../staff-register/guard/staff-admin-guard';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([MemberActivity, Staff, Admin]),
  ],
  providers: [
    StaffAuthGuard,
    UserAuthGuard,
    StaffOrAdminAuthGuard,
  ],
  exports: [
    StaffAuthGuard,
    UserAuthGuard,
    StaffOrAdminAuthGuard,
    TypeOrmModule, // Exporting to allow guards to use repositories
  ],
})
export class GuardsModule {}
