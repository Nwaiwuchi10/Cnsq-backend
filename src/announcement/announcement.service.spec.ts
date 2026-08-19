import { Test, TestingModule } from '@nestjs/testing';
import { AnnouncementService } from './announcement.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Announcement } from './entities/announcement.entity';
import { Admin } from '../admin/entities/admin.entity';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { NotificationService } from '../notification/notification.service';
import { PushNotification } from '../push-notification/entities/push-notification.entity';
import { AnnouncementRead } from './entities/announcementread.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  })),
});

const mockNotificationService = () => ({
  createNotifications: jest.fn(),
  createNotificationsForStaffs: jest.fn(),
});

describe('AnnouncementService', () => {
  let service: AnnouncementService;
  let announcementRepo: any;
  let adminRepo: any;
  let staffRepo: any;
  let notificationService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnouncementService,
        {
          provide: getRepositoryToken(Announcement),
          useFactory: mockRepository,
        },
        { provide: getRepositoryToken(Admin), useFactory: mockRepository },
        { provide: getRepositoryToken(Staff), useFactory: mockRepository },
        {
          provide: getRepositoryToken(AnnouncementRead),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(PushNotification),
          useFactory: mockRepository,
        },
        { provide: NotificationService, useFactory: mockNotificationService },
      ],
    }).compile();

    service = module.get<AnnouncementService>(AnnouncementService);
    announcementRepo = module.get(getRepositoryToken(Announcement));
    adminRepo = module.get(getRepositoryToken(Admin));
    staffRepo = module.get(getRepositoryToken(Staff));
    notificationService = module.get(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createAnnouncementDto = {
      title: 'Company Meeting',
      description: 'Important meeting announcement',
      selectedStaffIds: [1, 2],
    };

    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should create an announcement successfully', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      staffRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      announcementRepo.create.mockReturnValue(createAnnouncementDto);
      announcementRepo.save.mockResolvedValue(createAnnouncementDto);

      const result = await service.create(createAnnouncementDto, admin.id);

      expect(result.title).toEqual(createAnnouncementDto.title);
      expect(announcementRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if admin not found', async () => {
      adminRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createAnnouncementDto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of announcements', async () => {
      const announcements = [
        { id: 1, title: 'Meeting 1' },
        { id: 2, title: 'Meeting 2' },
      ];
      announcementRepo.find.mockResolvedValue(announcements);

      const result = await service.findAll({ page: 0, limit: 10 });

      expect(result).toEqual(announcements);
    });
  });

  describe('findOne', () => {
    it('should return a single announcement', async () => {
      const announcement = { id: 1, title: 'Meeting 1' };
      announcementRepo.findOne.mockResolvedValue(announcement);

      const result = await service.findOne(1);

      expect(result).toEqual(announcement);
    });

    it('should throw NotFoundException if announcement not found', async () => {
      announcementRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should remove an announcement successfully', async () => {
      const announcement = { id: 1, title: 'Meeting 1' };
      adminRepo.findOne.mockResolvedValue(admin);
      announcementRepo.findOne.mockResolvedValue(announcement);
      announcementRepo.remove.mockResolvedValue({});

      const result = await service.remove(1);

      expect(result).toEqual({ message: expect.any(String) });
    });
  });
});
