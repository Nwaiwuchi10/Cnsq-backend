import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: NotificationService,
          useValue: {
            createNotifications: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            markAsRead: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('notification methods', () => {
    it('should have createNotifications method', () => {
      expect(typeof service.createNotifications).toBe('function');
    });
  });
});
