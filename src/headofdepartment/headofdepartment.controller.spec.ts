import { Test, TestingModule } from '@nestjs/testing';
import { HeadofdepartmentController } from './headofdepartment.controller';
import { HeadofdepartmentService } from './headofdepartment.service';
import { UserAuthGuard } from '../admin/guard/auth.guard';

const mockHeadofdepartmentService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('HeadofdepartmentController', () => {
  let controller: HeadofdepartmentController;
  let service: any;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [HeadofdepartmentController],
      providers: [
        {
          provide: HeadofdepartmentService,
          useFactory: mockHeadofdepartmentService,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(UserAuthGuard)
      .useValue({ canActivate: () => true });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<HeadofdepartmentController>(
      HeadofdepartmentController,
    );
    service = module.get<HeadofdepartmentService>(HeadofdepartmentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('head of department operations', () => {
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
