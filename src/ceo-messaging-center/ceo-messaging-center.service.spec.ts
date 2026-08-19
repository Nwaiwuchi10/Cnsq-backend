import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CeoMessagingCenterService } from './ceo-messaging-center.service';
import { CeoMessagingCenter } from './entities/ceo-messaging-center.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { NotificationService } from 'src/notification/notification.service';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { CeoMessagingCenterMailService } from './service/ceo-messaging-center-mail.service';
import { Repository } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('CeoMessagingCenterService', () => {
  let service: CeoMessagingCenterService;
  let messageRepo: Repository<CeoMessagingCenter>;
  let staffRepo: Repository<Staff>;
  let mailService: CeoMessagingCenterMailService;
  let notificationService: NotificationService;
  let pushNotificationService: PushNotificationService;

  const mockMessageRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockStaffRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockMailService = {
    sendBroadcastEmail: jest.fn(),
  };

  const mockNotificationService = {
    createNotificationsForStaffs: jest.fn(),
  };

  const mockPushNotificationService = {
    sendNotification: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CeoMessagingCenterService,
        {
          provide: getRepositoryToken(CeoMessagingCenter),
          useValue: mockMessageRepo,
        },
        {
          provide: getRepositoryToken(Staff),
          useValue: mockStaffRepo,
        },
        {
          provide: CeoMessagingCenterMailService,
          useValue: mockMailService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: PushNotificationService,
          useValue: mockPushNotificationService,
        },
      ],
    }).compile();

    service = module.get<CeoMessagingCenterService>(CeoMessagingCenterService);
    messageRepo = module.get<Repository<CeoMessagingCenter>>(getRepositoryToken(CeoMessagingCenter));
    staffRepo = module.get<Repository<Staff>>(getRepositoryToken(Staff));
    mailService = module.get<CeoMessagingCenterMailService>(CeoMessagingCenterMailService);
    notificationService = module.get<NotificationService>(NotificationService);
    pushNotificationService = module.get<PushNotificationService>(PushNotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      title: 'Test Title',
      description: 'Test Description',
      isAllStaff: true,
    };

    it('should successfully create a message if sender is CEO', async () => {
      const mockSender = { id: 1, isCeo: true };
      const mockRecipients = [{ id: 2, email: 'staff@example.com' }];
      
      staffRepo.findOne = jest.fn().mockResolvedValue(mockSender);
      staffRepo.find = jest.fn().mockResolvedValue(mockRecipients);
      mockMessageRepo.create = jest.fn().mockImplementation(dto => dto);
      mockMessageRepo.save = jest.fn().mockImplementation(dto => Promise.resolve({ id: 'uuid', ...dto }));

      const result = await service.create(createDto, 1, []);

      expect(result.title).toBe(createDto.title);
      expect(mockMailService.sendBroadcastEmail).toHaveBeenCalled();
      expect(mockNotificationService.createNotificationsForStaffs).toHaveBeenCalled();
      expect(mockPushNotificationService.sendNotification).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if sender is not CEO', async () => {
      const mockSender = { id: 1, isCeo: false };
      staffRepo.findOne = jest.fn().mockResolvedValue(mockSender);

      await expect(service.create(createDto, 1, [])).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if staff not found', async () => {
      staffRepo.findOne = jest.fn().mockResolvedValue(null);

      await expect(service.create(createDto, 1, [])).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { title: 'Updated Title' };

    it('should successfully update a message if sender is owner', async () => {
      const mockMessage = { id: 'uuid', title: 'Old Title', sender: { id: 1 }, attachments: [] };
      mockMessageRepo.findOne = jest.fn().mockResolvedValue(mockMessage);
      mockMessageRepo.save = jest.fn().mockImplementation(dto => Promise.resolve(dto));

      const result = await service.update('uuid', updateDto, 1, []);

      expect(result.title).toBe('Updated Title');
      expect(mockMessageRepo.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if sender is not owner', async () => {
      const mockMessage = { id: 'uuid', sender: { id: 2 } };
      mockMessageRepo.findOne = jest.fn().mockResolvedValue(mockMessage);

      await expect(service.update('uuid', updateDto, 1, [])).rejects.toThrow(ForbiddenException);
    });
  });
});
