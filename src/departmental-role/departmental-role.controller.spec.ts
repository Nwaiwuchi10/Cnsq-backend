import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentalRoleController } from './departmental-role.controller';
import { DepartmentalRoleService } from './departmental-role.service';
import { UserAuthGuard } from '../admin/guard/auth.guard';

const mockDepartmentalRoleService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('DepartmentalRoleController', () => {
  let controller: DepartmentalRoleController;
  let service: any;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [DepartmentalRoleController],
      providers: [
        {
          provide: DepartmentalRoleService,
          useFactory: mockDepartmentalRoleService,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(UserAuthGuard)
      .useValue({ canActivate: () => true });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<DepartmentalRoleController>(
      DepartmentalRoleController,
    );
    service = module.get<DepartmentalRoleService>(DepartmentalRoleService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('departmental role operations', () => {
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
