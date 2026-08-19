import { Test, TestingModule } from '@nestjs/testing';
import { MessageCeoController } from './message-ceo.controller';
import { MessageCeoService } from './message-ceo.service';
import { CanActivate } from '@nestjs/common';
import { StaffAuthGuard } from '../staff-register/guard/staff.guard';

const mockMessageCeoService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

const mockGuard: CanActivate = {
  canActivate: jest.fn(() => true),
};

describe('MessageCeoController', () => {
  let controller: MessageCeoController;
  let service: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MessageCeoController],
      providers: [
        {
          provide: MessageCeoService,
          useFactory: mockMessageCeoService,
        },
      ],
    })
      .overrideGuard(StaffAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<MessageCeoController>(MessageCeoController);
    service = module.get<MessageCeoService>(MessageCeoService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('message to ceo operations', () => {
    it('should have create method', () => {
      expect(typeof controller.create).toBe('function');
    });

    it('should have findAll method', () => {
      expect(typeof controller.findAll).toBe('function');
    });

    it('should have findOne method', () => {
      expect(typeof controller.findOne).toBe('function');
    });

    it('should have update method', () => {
      expect(typeof controller.update).toBe('function');
    });

    it('should have remove method', () => {
      expect(typeof controller.remove).toBe('function');
    });
  });
});
