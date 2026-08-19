import { NotificationType } from '../entities/notification.entity';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateNotificationDto {
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsNumber()
  recipientId: number;

  @IsOptional()
  @IsNumber()
  triggeredByStaffId?: number;

  @IsOptional()
  @IsNumber()
  triggeredByAdminId?: number;

  @IsOptional()
  @IsNumber()
  relatedProjectId?: number;

  @IsOptional()
  @IsNumber()
  relatedTaskId?: number;
}

// src/notifications/dto/notification.dto.ts

export class ListNotificationsDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  recipientId?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  onlyUnread?: boolean;
}

export class MarkNotificationReadDto {
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}
