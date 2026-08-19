import { Test, TestingModule } from '@nestjs/testing';
import { AdminproductdemoController } from './adminproductdemo.controller';
import { AdminproductdemoService } from './adminproductdemo.service';
import { UserAuthGuard } from '../admin/guard/auth.guard';

const mockAdminproductdemoService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('AdminproductdemoController', () => {
  let controller: AdminproductdemoController;
  let service: any;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AdminproductdemoController],
      providers: [
        {
          provide: AdminproductdemoService,
          useFactory: mockAdminproductdemoService,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(UserAuthGuard)
      .useValue({ canActivate: () => true });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<AdminproductdemoController>(
      AdminproductdemoController,
    );
    service = module.get<AdminproductdemoService>(AdminproductdemoService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('admin product demo operations', () => {
    it('should have create method', () => {
      expect(typeof controller.create).toBe('function');
    });

    it('should have getAll method', () => {
      expect(typeof controller.getAll).toBe('function');
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
