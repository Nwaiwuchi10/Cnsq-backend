import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { join } from 'path';

import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from './config/config';
import { JwtModule } from '@nestjs/jwt';
import { RolesModule } from './roles/roles.module';
import { DepartmentsModule } from './departments/departments.module';
import { AdminModule } from './admin/admin.module';
import { StaffRegisterModule } from './staff-register/staff-register.module';
import { DepartmentalRoleModule } from './departmental-role/departmental-role.module';
import { HeadofdepartmentModule } from './headofdepartment/headofdepartment.module';
import { PermissionsModule } from './permissions/permissions.module';
import { ProjectsModule } from './projects/projects.module';
import { TaskModule } from './task/task.module';
import { BirthdayModule } from './birthday/birthday.module';
import { NotificationModule } from './notification/notification.module';
import { AdminproductdemoModule } from './adminproductdemo/adminproductdemo.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AnnouncementModule } from './announcement/announcement.module';
import { MessageCeoModule } from './message-ceo/message-ceo.module';
import { QuoteModule } from './quote/quote.module';
import { CeoMessagingCenterModule } from './ceo-messaging-center/ceo-messaging-center.module';

import { ChatModule } from './chat/chat.module';
import { PushNotificationModule } from './push-notification/push-notification.module';
import { CalenderModule } from './calender/calender.module';
import { DocumentationModule } from './documentation/documentation.module';
import { NotificationSettingsModule } from './notification-settings/notification-settings.module';
import { MemberActivityModule } from './member-activity/member-activity.module';
import { ServerErrorModule } from './server-error/server-error.module';
import { GuardsModule } from './common/guards/guards.module';
import { HeroContentModule } from './hero-content/hero-content.module';
import { LeaveRequestModule } from './leave-request/leave-request.module';
import { CallsModule } from './calls/calls.module';

import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TicketingModule } from './ticketing/ticketing.module';
import { PipelineModule } from './pipeline/pipeline.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [config],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config) => ({
        secret: config.get('jwt.secret'),
        signOptions: {
          expiresIn: config.get('jwt.expiresIn'),
        },
      }),
      global: true,
      inject: [ConfigService],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: +configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PAASWORD'),
        database: configService.get('DB_NAME'),
        ssl:
          configService.get('DB_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : undefined,
        entities: [join(__dirname, '**/*.entity{.ts,.js}')],
        //  entities: [join(process.cwd(), 'dist/**/*.entity.js')],
        // entities: [City, UserAuth],
        // entities: [City],
        synchronize: true,
      }),
    }),
    RolesModule,
    DepartmentsModule,
    AdminModule,
    StaffRegisterModule,
    DepartmentalRoleModule,
    HeadofdepartmentModule,
    PermissionsModule,
    ProjectsModule,
    TaskModule,
    BirthdayModule,
    NotificationModule,
    AdminproductdemoModule,
    AnnouncementModule,
    MessageCeoModule,
    QuoteModule,
    CeoMessagingCenterModule,
    ChatModule,
    PushNotificationModule,
    CalenderModule,
    DocumentationModule,
    NotificationSettingsModule,
    MemberActivityModule,
    ServerErrorModule,
    GuardsModule,
    HeroContentModule,
    LeaveRequestModule,
    TicketingModule,
    PipelineModule,
    CallsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule { }
