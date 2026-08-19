// src/notification-settings/notification-settings.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationSettings } from './entities/notification-settings.entity';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationSettingsController } from './notification-settings.controller';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';

/**
 * NOTE: We deliberately do NOT import StaffRegisterModule here to avoid
 * a circular dependency (StaffRegisterModule → NotificationSettingsModule
 * → StaffRegisterModule). Instead, we declare StaffAuthGuard directly as
 * a provider — JwtModule is global, so JwtService is available everywhere.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationSettings]),
  ],
  controllers: [NotificationSettingsController],
  providers: [
    NotificationSettingsService,
  ],
  exports: [NotificationSettingsService],
})
export class NotificationSettingsModule {}
