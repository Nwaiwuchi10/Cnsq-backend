import { Test, TestingModule } from '@nestjs/testing';
import { PushNotificationController } from './push-notification.controller';
import { PushNotificationService } from './push-notification.service';
import { StaffAuthGuard } from '../staff-register/guard/staff.guard';

const mockPushNotificationService = () => ({
  subscribeUser: jest.fn(),
  sendNotification: jest.fn(),
  unsubscribeUser: jest.fn(),
});

describe('PushNotificationController', () => {
  let controller: PushNotificationController;
  let service: any;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [PushNotificationController],
      providers: [
        {
          provide: PushNotificationService,
          useFactory: mockPushNotificationService,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(StaffAuthGuard)
      .useValue({ canActivate: () => true });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<PushNotificationController>(
      PushNotificationController,
    );
    service = module.get<PushNotificationService>(PushNotificationService);
  });

  it('it should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('push notification operations', () => {
    it('should have subscribe method', () => {
      expect(typeof controller.subscribe).toBe('function');
    });
  });
});
