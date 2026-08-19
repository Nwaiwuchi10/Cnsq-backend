import { Test, TestingModule } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { StaffAuthGuard } from '../staff-register/guard/staff.guard';

const mockChatService = () => ({
  createConversation: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('ChatController', () => {
  let controller: ChatController;
  let service: any;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useFactory: mockChatService,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(StaffAuthGuard)
      .useValue({ canActivate: () => true });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<ChatController>(ChatController);
    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('chat operations', () => {
    it('should have methods defined', () => {
      expect(controller).toBeDefined();
      expect(typeof controller.createConversation).toBe('function');
    });
  });
});
