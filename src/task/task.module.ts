// Task module definition for project tasks management
import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';

import { Project } from 'src/projects/entities/project.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { TaskAssignment } from './entities/task-asessment.entity';
import { TaskComment } from './entities/task-comments.entity';
import { TaskMailService } from './service/mail.service';
import { ProjectAssignment } from 'src/projects/entities/project-assessment.entity';
import { NotificationModule } from 'src/notification/notification.module';
import { Notification } from 'src/notification/entities/notification.entity';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { PushNotification } from 'src/push-notification/entities/push-notification.entity';
import { Department } from 'src/departments/entities/department.entity';
import { HeadOfDepartment } from 'src/headofdepartment/entities/headofdepartment.entity';
import { ProjectCompletionService } from './service/project-completion.service';

import { MemberActivityModule } from 'src/member-activity/member-activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Task,
      TaskAssignment,
      Project,
      Staff,
      TaskComment,
      ProjectAssignment,
      Notification,
      PushNotification,
      Department,
      HeadOfDepartment,
    ]),
    NotificationModule,
    MemberActivityModule,
  ],
  controllers: [TaskController],
  providers: [TaskService, TaskMailService, PushNotificationService, ProjectCompletionService],
})
export class TaskModule {}
