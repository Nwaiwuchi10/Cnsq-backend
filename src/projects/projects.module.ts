import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectAssignment } from './entities/project-assessment.entity';
import { ProjectComment } from './entities/project-comment.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { ProjectMailService } from './services/mail.service';
import { Department } from 'src/departments/entities/department.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';
import { StaffOrAdminAuthGuard } from 'src/staff-register/guard/staff-admin-guard';
import { NotificationModule } from 'src/notification/notification.module';
import { Notification } from 'src/notification/entities/notification.entity';
import { Task } from 'src/task/entities/task.entity';

import { MemberActivityModule } from 'src/member-activity/member-activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      ProjectAssignment,
      ProjectComment,
      Staff,
      Department,
      Admin,
      Notification,
      Task,
    ]),
    NotificationModule,
    MemberActivityModule,
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectMailService,
  ],
})
export class ProjectsModule {}
