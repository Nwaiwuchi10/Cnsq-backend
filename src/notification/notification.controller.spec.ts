import { Test, TestingModule } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { StaffAuthGuard } from '../staff-register/guard/staff.guard';

const mockNotificationService = () => ({
  createNotification: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  markAsRead: jest.fn(),
  remove: jest.fn(),
});

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: any;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useFactory: mockNotificationService,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(StaffAuthGuard)
      .useValue({ canActivate: () => true });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<NotificationController>(NotificationController);
    service = module.get<NotificationService>(NotificationService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('notification operations', () => {
    it('should have methods defined', () => {
      expect(controller).toBeDefined();
      expect(typeof controller.findAll).toBe('function');
    });
  });
});
