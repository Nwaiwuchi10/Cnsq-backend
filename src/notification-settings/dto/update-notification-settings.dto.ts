// src/notification-settings/dto/update-notification-settings.dto.ts
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  projectUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  taskReminders?: boolean;

  @IsOptional()
  @IsBoolean()
  celebrationAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  weeklyReport?: boolean;

  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;
}
