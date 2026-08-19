import { Test, TestingModule } from '@nestjs/testing';
import { PushNotificationService } from './push-notification.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PushNotification } from './entities/push-notification.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let mockRepository: any;

  const mockPushNotification = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    endpoint: 'https://example.com/push',
    data: { keys: { p256dh: 'test', auth: 'test' } },
    userId: 1,
    createdAt: new Date(),
    updatedAt: null,
  };

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn().mockReturnValue(mockPushNotification),
      save: jest.fn().mockResolvedValue(mockPushNotification),
      find: jest.fn().mockResolvedValue([mockPushNotification]),
      findOne: jest.fn().mockResolvedValue(mockPushNotification),
      remove: jest.fn().mockResolvedValue(mockPushNotification),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      clear: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        {
          provide: getRepositoryToken(PushNotification),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PushNotificationService>(PushNotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveSubscription', () => {
    it('should save a new subscription', async () => {
      const subscriptionData = {
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'test', auth: 'test' },
      };

      mockRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.saveSubscription(subscriptionData as any, 1);

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockPushNotification);
    });

    it('should throw BadRequestException for invalid userId', async () => {
      const subscriptionData = {
        endpoint: 'https://example.com/push',
        keys: { p256dh: 'test', auth: 'test' },
      };

      await expect(
        service.saveSubscription(subscriptionData as any, -1),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getByUser', () => {
    it('should return subscriptions for a user', async () => {
      const result = await service.getByUser(1);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockPushNotification]);
    });

    it('should throw BadRequestException for invalid userId', async () => {
      await expect(service.getByUser(-1)).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteById', () => {
    it('should delete a subscription by id', async () => {
      await service.deleteById('550e8400-e29b-41d4-a716-446655440000');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(mockRepository.remove).toHaveBeenCalled();
    });

    it('should throw NotFoundException when subscription not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.deleteById('550e8400-e29b-41d4-a716-446655440000'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid id', async () => {
      await expect(service.deleteById('')).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteByUser', () => {
    it('should delete all subscriptions for a user', async () => {
      await service.deleteByUser(1);

      expect(mockRepository.delete).toHaveBeenCalledWith({ userId: 1 });
    });

    it('should throw BadRequestException for invalid userId', async () => {
      await expect(service.deleteByUser(-1)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getById', () => {
    it('should return a subscription by id', async () => {
      const result = await service.getById(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(result).toEqual(mockPushNotification);
    });

    it('should throw NotFoundException when subscription not found', async () => {
      mockRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.getById('550e8400-e29b-41d4-a716-446655440000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAll', () => {
    it('should delete all subscriptions', async () => {
      await service.deleteAll();

      expect(mockRepository.clear).toHaveBeenCalled();
    });
  });
});
