import { Test, TestingModule } from '@nestjs/testing';
import { BirthdayController } from './birthday.controller';
import { BirthdayService } from './birthday.service';

const mockBirthdayService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('BirthdayController', () => {
  let controller: BirthdayController;
  let service: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BirthdayController],
      providers: [
        {
          provide: BirthdayService,
          useFactory: mockBirthdayService,
        },
      ],
    }).compile();

    controller = module.get<BirthdayController>(BirthdayController);
    service = module.get<BirthdayService>(BirthdayService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('CRUD operations', () => {
    it('should call create', async () => {
      const dto = { name: 'Birthday Event' };
      service.create.mockReturnValue('This action adds a new birthday');
      const result = controller.create(dto);
      expect(result).toBeDefined();
    });

    it('should call findAll', async () => {
      service.findAll.mockReturnValue('This action returns all birthday');
      const result = controller.findAll();
      expect(result).toBeDefined();
    });

    it('should call findOne', async () => {
      service.findOne.mockReturnValue('This action returns a #1 birthday');
      const result = controller.findOne('1');
      expect(result).toBeDefined();
    });

    it('should call update', async () => {
      const dto = { name: 'Updated' };
      service.update.mockReturnValue('This action updates a #1 birthday');
      const result = controller.update('1', dto);
      expect(result).toBeDefined();
    });

    it('should call remove', async () => {
      service.remove.mockReturnValue('This action removes a #1 birthday');
      const result = controller.remove('1');
      expect(result).toBeDefined();
    });
  });
});
