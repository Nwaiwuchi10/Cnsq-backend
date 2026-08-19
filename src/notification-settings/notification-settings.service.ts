// src/notification-settings/notification-settings.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationSettings } from './entities/notification-settings.entity';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

/** Union of all settable preference keys */
export type NotificationSettingKey = keyof Pick<
  NotificationSettings,
  | 'emailNotifications'
  | 'projectUpdates'
  | 'taskReminders'
  | 'celebrationAlerts'
  | 'weeklyReport'
>;

@Injectable()
export class NotificationSettingsService {
  constructor(
    @InjectRepository(NotificationSettings)
    private readonly settingsRepo: Repository<NotificationSettings>,
  ) {}

  /**
   * Returns the notification settings for a staff member.
   * If no settings row exists yet, creates one with all defaults.
   */
  async getSettings(staffId: number): Promise<NotificationSettings> {
    let settings = await this.settingsRepo.findOne({ where: { staffId } });

    if (!settings) {
      settings = this.settingsRepo.create({ staffId });
      settings = await this.settingsRepo.save(settings);
    }

    return settings;
  }

  /**
   * Creates or updates the notification settings for a staff member.
   * Only the fields provided in the DTO are updated (partial update).
   */
  async upsertSettings(
    staffId: number,
    dto: UpdateNotificationSettingsDto,
  ): Promise<NotificationSettings> {
    let settings = await this.settingsRepo.findOne({ where: { staffId } });

    if (!settings) {
      settings = this.settingsRepo.create({ staffId, ...dto });
    } else {
      Object.assign(settings, dto);
    }

    return this.settingsRepo.save(settings);
  }

  /**
   * Checks whether a specific notification channel is enabled for a staff.
   *
   * SAFE DEFAULT: returns `true` (allow) when no settings row exists,
   * so existing staff continue receiving notifications until they configure preferences.
   *
   * @param staffId  ID of the staff member
   * @param key      The preference key to check (e.g. 'projectUpdates')
   */
  async isAllowed(
    staffId: number,
    key: NotificationSettingKey,
  ): Promise<boolean> {
    const settings = await this.settingsRepo.findOne({ where: { staffId } });

    // No row yet → default allow everything
    if (!settings) return true;

    return settings[key] === true;
  }
}
