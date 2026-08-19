import { Module } from '@nestjs/common';
import { StaffRegisterService } from './staff-register.service';
import { StaffRegisterController } from './staff-register.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentalRole } from 'src/departmental-role/entities/departmental-role.entity';
import { Department } from 'src/departments/entities/department.entity';
import { Staff, StaffRegister } from './entities/staff-register.entity';
import { StaffEmployment } from './entities/staff-employment.entity';
import { StaffAddress } from './entities/staf-adress.entity';
import { MailService } from './service/mail.service';
import { Role } from 'src/roles/entities/role.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { StaffOrAdminAuthGuard } from './guard/staff-admin-guard';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';
import { StaffAuthGuard } from './guard/staff.guard';
import { TaskAssignment } from 'src/task/entities/task-asessment.entity';
import { Project } from 'src/projects/entities/project.entity';
import { NotificationSettingsModule } from 'src/notification-settings/notification-settings.module';
import { MemberActivityModule } from 'src/member-activity/member-activity.module';
import { MemberActivity } from 'src/member-activity/entities/member-activity.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DepartmentalRole,
      StaffRegister,
      StaffEmployment,
      Staff,
      StaffAddress,
      Department,
      Role,
      Admin,
      TaskAssignment,
      Project,
      MemberActivity,
    ]),
    NotificationSettingsModule, // needed so MailService can inject NotificationSettingsService
    MemberActivityModule,
  ],
  controllers: [StaffRegisterController],
  providers: [
    StaffRegisterService,
    MailService,
    StaffAuthGuard,
    UserAuthGuard,
    StaffOrAdminAuthGuard,
  ],
  exports: [MailService, StaffRegisterService],
})
export class StaffRegisterModule { }
