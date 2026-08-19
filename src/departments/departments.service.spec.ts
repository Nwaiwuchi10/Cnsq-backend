import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsService } from './departments.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Department } from './entities/department.entity';
import { Admin } from '../admin/entities/admin.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let deptRepo: any;
  let adminRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: getRepositoryToken(Department), useFactory: mockRepository },
        { provide: getRepositoryToken(Admin), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
    deptRepo = module.get(getRepositoryToken(Department));
    adminRepo = module.get(getRepositoryToken(Admin));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDeptDto = {
      name: 'IT Department',
      nameAbrv: 'IT',
      description: 'IT related tasks',
    };

    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should create a department successfully', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      deptRepo.findOne.mockResolvedValue(null);
      deptRepo.create.mockReturnValue(createDeptDto);
      deptRepo.save.mockResolvedValue(createDeptDto);

      const result = await service.create(createDeptDto, '1');

      expect(result.name).toEqual(createDeptDto.name);
      expect(deptRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user is not admin', async () => {
      const notAdmin = { ...admin, isAdmin: false };
      adminRepo.findOne.mockResolvedValue(notAdmin);

      await expect(service.create(createDeptDto, '1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if department already exists', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      deptRepo.findOne.mockResolvedValue(createDeptDto);

      await expect(service.create(createDeptDto, '1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of departments', async () => {
      const departments = [
        { id: 1, name: 'IT' },
        { id: 2, name: 'HR' },
      ];
      deptRepo.find.mockResolvedValue(departments);

      const result = await service.findAll();

      expect(result).toEqual(departments);
      expect(deptRepo.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single department', async () => {
      const department = { id: 1, name: 'IT' };
      deptRepo.findOne.mockResolvedValue(department);

      const result = await service.findOne(1);

      expect(result).toEqual(department);
    });
  });

  describe('update', () => {
    const updateDeptDto = {
      name: 'Updated IT',
    };

    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should update a department successfully', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      deptRepo.findOne.mockResolvedValue(updateDeptDto);
      deptRepo.save.mockResolvedValue(updateDeptDto);

      const result = await service.update(1, updateDeptDto, '1');

      expect(result).toBeDefined();
      expect(deptRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should remove a department successfully', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      deptRepo.findOne.mockResolvedValue({ id: 1, name: 'IT' });
      deptRepo.remove.mockResolvedValue({});

      await service.remove(1, '1');

      expect(deptRepo.remove).toHaveBeenCalled();
    });
  });
});
