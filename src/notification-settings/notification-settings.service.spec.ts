/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationSettingsService } from './notification-settings.service';
import { NotificationSettings } from './entities/notification-settings.entity';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

describe('NotificationSettingsService', () => {
  let service: NotificationSettingsService;
  let repository: Repository<NotificationSettings>;

  const mockSettings: NotificationSettings = {
    id: 'uuid-1',
    staffId: 1,
    emailNotifications: true,
    projectUpdates: true,
    taskReminders: true,
    celebrationAlerts: true,
    weeklyReport: false,
    staff: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationSettingsService,
        {
          provide: getRepositoryToken(NotificationSettings),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<NotificationSettingsService>(
      NotificationSettingsService,
    );
    repository = module.get<Repository<NotificationSettings>>(
      getRepositoryToken(NotificationSettings),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return existing settings for a staff member', async () => {
      mockRepository.findOne.mockResolvedValue(mockSettings);

      const result = await service.getSettings(1);

      expect(result).toEqual(mockSettings);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { staffId: 1 },
      });
    });

    it('should create and return default settings if none exist', async () => {
      const newSettings = {
        ...mockSettings,
        id: undefined,
      };

      mockRepository.findOne.mockResolvedValueOnce(null);
      mockRepository.create.mockReturnValue(newSettings);
      mockRepository.save.mockResolvedValue(mockSettings);

      const result = await service.getSettings(1);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { staffId: 1 },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({ staffId: 1 });
      expect(mockRepository.save).toHaveBeenCalledWith(newSettings);
      expect(result).toEqual(mockSettings);
    });
  });

  describe('upsertSettings', () => {
    it('should update existing settings', async () => {
      const updateDto: UpdateNotificationSettingsDto = {
        projectUpdates: false,
        taskReminders: false,
      };

      const updatedSettings = {
        ...mockSettings,
        projectUpdates: false,
        taskReminders: false,
      };

      mockRepository.findOne.mockResolvedValue(mockSettings);
      mockRepository.save.mockResolvedValue(updatedSettings);

      const result = await service.upsertSettings(1, updateDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { staffId: 1 },
      });
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(updatedSettings);
    });

    it('should create new settings if none exist', async () => {
      const updateDto: UpdateNotificationSettingsDto = {
        emailNotifications: false,
      };

      const newSettings = {
        ...mockSettings,
        emailNotifications: false,
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(newSettings);
      mockRepository.save.mockResolvedValue(newSettings);

      const result = await service.upsertSettings(1, updateDto);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { staffId: 1 },
      });
      expect(mockRepository.create).toHaveBeenCalledWith({
        staffId: 1,
        ...updateDto,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(newSettings);
      expect(result).toEqual(newSettings);
    });

    it('should perform partial update (only specified fields)', async () => {
      const updateDto: UpdateNotificationSettingsDto = {
        weeklyReport: true,
      };

      const partialSettings = { ...mockSettings };
      mockRepository.findOne.mockResolvedValue(mockSettings);
      mockRepository.save.mockResolvedValue(partialSettings);

      await service.upsertSettings(1, updateDto);

      expect(mockRepository.save).toHaveBeenCalled();
      // Verify that Object.assign was called with the update dto
      const savedEntity = mockRepository.save.mock.calls[0][0];
      expect(savedEntity.weeklyReport).toEqual(true);
    });
  });

  describe('isAllowed', () => {
    it('should return true if setting is enabled', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockSettings,
        projectUpdates: true,
      });

      const result = await service.isAllowed(1, 'projectUpdates');

      expect(result).toBe(true);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { staffId: 1 },
      });
    });

    it('should return false if setting is disabled', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockSettings,
        projectUpdates: false,
      });

      const result = await service.isAllowed(1, 'projectUpdates');

      expect(result).toBe(false);
    });

    it('should return true (default allow) if no settings exist', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.isAllowed(1, 'projectUpdates');

      expect(result).toBe(true);
    });

    it('should check different preference keys', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...mockSettings,
        taskReminders: false,
      });

      const result = await service.isAllowed(1, 'taskReminders');

      expect(result).toBe(false);
    });
  });
});
