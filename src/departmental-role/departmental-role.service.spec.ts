import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentalRoleService } from './departmental-role.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DepartmentalRole } from './entities/departmental-role.entity';
import { Department } from '../departments/entities/department.entity';
import { Admin } from '../admin/entities/admin.entity';
import { StaffEmployment } from '../staff-register/entities/staff-employment.entity';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

describe('DepartmentalRoleService', () => {
  let service: DepartmentalRoleService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentalRoleService,
        {
          provide: getRepositoryToken(DepartmentalRole),
          useFactory: mockRepository,
        },
        { provide: getRepositoryToken(Department), useFactory: mockRepository },
        { provide: getRepositoryToken(Admin), useFactory: mockRepository },
        {
          provide: getRepositoryToken(StaffEmployment),
          useFactory: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DepartmentalRoleService>(DepartmentalRoleService);
  });

  it('it should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('departmental role methods', () => {
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
