import { Test, TestingModule } from '@nestjs/testing';
import { HeadofdepartmentService } from './headofdepartment.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HeadOfDepartment } from './entities/headofdepartment.entity';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { Department } from '../departments/entities/department.entity';
import { Admin } from '../admin/entities/admin.entity';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

describe('HeadofdepartmentService', () => {
  let service: HeadofdepartmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeadofdepartmentService,
        {
          provide: getRepositoryToken(HeadOfDepartment),
          useFactory: mockRepository,
        },
        { provide: getRepositoryToken(Staff), useFactory: mockRepository },
        { provide: getRepositoryToken(Department), useFactory: mockRepository },
        { provide: getRepositoryToken(Admin), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<HeadofdepartmentService>(HeadofdepartmentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('head of department methods', () => {
    it('should have create method', () => {
      expect(typeof service.create).toBe('function');
    });

    it('should have findAll method', () => {
      expect(typeof service.findAll).toBe('function');
    });

    it('should have findOne method', () => {
      expect(typeof service.findOne).toBe('function');
    });

    it('should have update method', () => {
      expect(typeof service.update).toBe('function');
    });

    it('should have remove method', () => {
      expect(typeof service.remove).toBe('function');
    });
  });
});
