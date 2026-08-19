import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';
import { CanActivate } from '@nestjs/common';
import { UserAuthGuard } from '../admin/guard/auth.guard';

const mockDepartmentsService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

const mockGuard: CanActivate = {
  canActivate: jest.fn(() => true),
};

describe('DepartmentsController', () => {
  let controller: DepartmentsController;
  let service: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController],
      providers: [
        {
          provide: DepartmentsService,
          useFactory: mockDepartmentsService,
        },
      ],
    })
      .overrideGuard(UserAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<DepartmentsController>(DepartmentsController);
    service = module.get<DepartmentsService>(DepartmentsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a department', async () => {
      const createDeptDto = { name: 'IT Department', nameAbrv: 'IT' };
      service.create.mockResolvedValue(createDeptDto);

      const result = await controller.create(createDeptDto, { userId: '1' });
      expect(result.name).toEqual(createDeptDto.name);
      expect(service.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all departments', async () => {
      const departments = [{ id: 1, name: 'IT', nameAbrv: 'IT' }];
      service.findAll.mockResolvedValue(departments);

      const result = await controller.findAll();
      expect(result).toEqual(departments);
    });
  });

  describe('findOne', () => {
    it('should return a single department', async () => {
      const department = { id: 1, name: 'IT', nameAbrv: 'IT' };
      service.findOne.mockResolvedValue(department);

      const result = await controller.findOne('1');
      expect(result).toEqual(department);
    });
  });

  describe('update', () => {
    it('should update a department', async () => {
      const updateDeptDto = { name: 'Updated IT', nameAbrv: 'UIT' };
      service.update.mockResolvedValue(updateDeptDto);

      const result = await controller.update('1', updateDeptDto, {
        userId: '1',
      });
      expect(result.name).toEqual(updateDeptDto.name);
    });
  });

  describe('remove', () => {
    it('should remove a department', async () => {
      service.remove.mockResolvedValue({});
      await controller.remove('1', { userId: '1' });
      expect(service.remove).toHaveBeenCalled();
    });
  });
});
