import { Test, TestingModule } from '@nestjs/testing';
import { MessageCeoService } from './message-ceo.service';

describe('MessageCeoService', () => {
  let service: MessageCeoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: MessageCeoService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MessageCeoService>(MessageCeoService);
  });

  it('it should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('message to ceo methods', () => {
    it('should have create method', () => {
      expect(typeof service.create).toBe('function');
    });

    it('should have findAll method', () => {
      expect(typeof service.findAll).toBe('function');
    });
  });
});
