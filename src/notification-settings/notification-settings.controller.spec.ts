/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationSettingsController } from './notification-settings.controller';
import { NotificationSettingsService } from './notification-settings.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

describe('NotificationSettingsController', () => {
  let controller: NotificationSettingsController;
  let service: NotificationSettingsService;

  const mockSettings = {
    id: 'uuid-1',
    staffId: 1,
    emailNotifications: true,
    projectUpdates: true,
    taskReminders: true,
    celebrationAlerts: true,
    weeklyReport: false,
    staff: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockService = {
    getSettings: jest.fn(),
    upsertSettings: jest.fn(),
    isAllowed: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationSettingsController],
      providers: [
        {
          provide: NotificationSettingsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<NotificationSettingsController>(
      NotificationSettingsController,
    );
    service = module.get<NotificationSettingsService>(
      NotificationSettingsService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMySettings', () => {
    it('should return current user notification settings', async () => {
      const mockReq = { staffId: 1 };
      mockService.getSettings.mockResolvedValue(mockSettings);

      const result = await controller.getMySettings(mockReq);

      expect(mockService.getSettings).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockSettings);
    });

    it('should handle different staff IDs', async () => {
      const mockReq = { staffId: 42 };
      const differentSettings = { ...mockSettings, staffId: 42 };

      mockService.getSettings.mockResolvedValue(differentSettings);

      const result = await controller.getMySettings(mockReq);

      expect(mockService.getSettings).toHaveBeenCalledWith(42);
      expect(result.staffId).toBe(42);
    });

    it('should return default settings when no preferences set', async () => {
      const mockReq = { staffId: 1 };
      const defaultSettings = {
        ...mockSettings,
        id: 'uuid-new',
      };

      mockService.getSettings.mockResolvedValue(defaultSettings);

      const result = await controller.getMySettings(mockReq);

      expect(result).toEqual(defaultSettings);
    });
  });

  describe('updateMySettings', () => {
    it('should update user notification settings successfully', async () => {
      const mockReq = { staffId: 1 };
      const updateDto: UpdateNotificationSettingsDto = {
        projectUpdates: false,
      };
      const updatedSettings = {
        ...mockSettings,
        projectUpdates: false,
      };

      mockService.upsertSettings.mockResolvedValue(updatedSettings);

      const result = await controller.updateMySettings(mockReq, updateDto);

      expect(mockService.upsertSettings).toHaveBeenCalledWith(1, updateDto);
      expect(result).toEqual({
        message: 'Notification settings updated successfully',
        settings: updatedSettings,
      });
    });

    it('should handle partial updates', async () => {
      const mockReq = { staffId: 1 };
      const updateDto: UpdateNotificationSettingsDto = {
        emailNotifications: false,
        taskReminders: true,
      };
      const updatedSettings = {
        ...mockSettings,
        emailNotifications: false,
        taskReminders: true,
      };

      mockService.upsertSettings.mockResolvedValue(updatedSettings);

      const result = await controller.updateMySettings(mockReq, updateDto);

      expect(mockService.upsertSettings).toHaveBeenCalledWith(1, updateDto);
      expect(result.settings).toEqual(updatedSettings);
    });

    it('should handle empty update (no fields specified)', async () => {
      const mockReq = { staffId: 1 };
      const updateDto: UpdateNotificationSettingsDto = {};

      mockService.upsertSettings.mockResolvedValue(mockSettings);

      const result = await controller.updateMySettings(mockReq, updateDto);

      expect(mockService.upsertSettings).toHaveBeenCalledWith(1, updateDto);
      expect(result.message).toBe('Notification settings updated successfully');
    });

    it('should update all preference toggles', async () => {
      const mockReq = { staffId: 1 };
      const updateDto: UpdateNotificationSettingsDto = {
        emailNotifications: false,
        projectUpdates: false,
        taskReminders: false,
        celebrationAlerts: false,
        weeklyReport: true,
      };
      const updatedSettings = {
        ...mockSettings,
        ...updateDto,
      };

      mockService.upsertSettings.mockResolvedValue(updatedSettings);

      const result = await controller.updateMySettings(mockReq, updateDto);

      expect(mockService.upsertSettings).toHaveBeenCalledWith(1, updateDto);
      expect(result.settings).toEqual(updatedSettings);
    });

    it('should return success response format', async () => {
      const mockReq = { staffId: 1 };
      const updateDto: UpdateNotificationSettingsDto = {
        projectUpdates: true,
      };

      mockService.upsertSettings.mockResolvedValue(mockSettings);

      const result = await controller.updateMySettings(mockReq, updateDto);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('settings');
      expect(result.message).toEqual(
        'Notification settings updated successfully',
      );
    });
  });

  describe('Integration scenarios', () => {
    it('should allow getting then updating settings in sequence', async () => {
      const mockReq = { staffId: 1 };

      // First, get settings
      mockService.getSettings.mockResolvedValue(mockSettings);
      const getResult = await controller.getMySettings(mockReq);
      expect(getResult.projectUpdates).toBe(true);

      // Then update
      const updateDto: UpdateNotificationSettingsDto = {
        projectUpdates: false,
      };
      const updatedSettings = {
        ...mockSettings,
        projectUpdates: false,
      };
      mockService.upsertSettings.mockResolvedValue(updatedSettings);
      const updateResult = await controller.updateMySettings(
        mockReq,
        updateDto,
      );

      expect(updateResult.settings.projectUpdates).toBe(false);
    });

    it('should handle multiple staff members independently', async () => {
      const req1 = { staffId: 1 };
      const req2 = { staffId: 2 };
      const settings1 = { ...mockSettings, staffId: 1 };
      const settings2 = { ...mockSettings, staffId: 2 };

      mockService.getSettings
        .mockResolvedValueOnce(settings1)
        .mockResolvedValueOnce(settings2);

      const result1 = await controller.getMySettings(req1);
      const result2 = await controller.getMySettings(req2);

      expect(result1.staffId).toBe(1);
      expect(result2.staffId).toBe(2);
      expect(mockService.getSettings).toHaveBeenCalledTimes(2);
    });
  });
});
