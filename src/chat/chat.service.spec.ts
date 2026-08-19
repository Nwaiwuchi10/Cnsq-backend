import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ChatService,
          useValue: {
            createConversation: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('core methods', () => {
    it('should have createConversation method', () => {
      expect(typeof service.createConversation).toBe('function');
    });

    it('should have findAll method', () => {
      expect(typeof service.findAll).toBe('function');
    });
  });
  it('should have remove method', () => {
    expect(typeof service.remove).toBe('function');
  });
});
