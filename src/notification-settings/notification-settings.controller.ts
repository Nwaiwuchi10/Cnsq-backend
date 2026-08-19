// src/notification-settings/notification-settings.controller.ts
import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationSettingsService } from './notification-settings.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';

@Controller('notification-settings')
@UseGuards(StaffAuthGuard)
export class NotificationSettingsController {
  constructor(
    private readonly notificationSettingsService: NotificationSettingsService,
  ) {}

  /**
   * GET /notification-settings/me
   * Returns the authenticated staff member's current notification preferences.
   * If no preferences have been set yet, returns the default values.
   */
  @Get('me')
  async getMySettings(@Req() req) {
    const staffId: number = req.staffId;
    return this.notificationSettingsService.getSettings(staffId);
  }

  /**
   * PATCH /notification-settings/me
   * Saves the staff member's notification preferences.
   * Only the fields included in the request body are updated (partial update).
   *
   * Example body:
   * {
   *   "emailNotifications": true,
   *   "projectUpdates": false,
   *   "taskReminders": true,
   *   "celebrationAlerts": true,
   *   "weeklyReport": false
   * }
   */
  @Patch('me')
  async updateMySettings(
    @Req() req,
    @Body() dto: UpdateNotificationSettingsDto,
  ) {
    const staffId: number = req.staffId;
    const updated = await this.notificationSettingsService.upsertSettings(
      staffId,
      dto,
    );
    return {
      message: 'Notification settings updated successfully',
      settings: updated,
    };
  }
}
