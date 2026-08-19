import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PipelineService } from './pipeline.service';
import { PipelineController } from './pipeline.controller';
import { PipelineIdea } from './entities/pipeline-idea.entity';
import { PipelineComment } from './entities/pipeline-comment.entity';
import { PipelineReaction } from './entities/pipeline-reaction.entity';
import { PipelineCommentReaction } from './entities/pipeline-comment-reaction.entity';
import { NotificationModule } from '../notification/notification.module';
import { PushNotificationModule } from '../push-notification/push-notification.module';
import { StaffRegisterModule } from '../staff-register/staff-register.module';
import { DepartmentsModule } from '../departments/departments.module';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { Department } from '../departments/entities/department.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PipelineIdea,
      PipelineComment,
      PipelineReaction,
      PipelineCommentReaction,
      Staff,
      Department
    ]),
    NotificationModule,
    PushNotificationModule,
    StaffRegisterModule,
    DepartmentsModule
  ],
  controllers: [PipelineController],
  providers: [PipelineService],
  exports: [PipelineService],
})
export class PipelineModule {}
