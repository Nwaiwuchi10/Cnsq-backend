import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from './roles.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Permission } from '../permissions/entities/permission.entity';
import { Admin } from '../admin/entities/admin.entity';
import { ConflictException, NotFoundException } from '@nestjs/common';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

describe('RolesService', () => {
  let service: RolesService;
  let roleRepo: any;
  let permissionRepo: any;
  let adminRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useFactory: mockRepository },
        { provide: getRepositoryToken(Permission), useFactory: mockRepository },
        { provide: getRepositoryToken(Admin), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
    roleRepo = module.get(getRepositoryToken(Role));
    permissionRepo = module.get(getRepositoryToken(Permission));
    adminRepo = module.get(getRepositoryToken(Admin));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createRoleDto = {
      name: 'Admin',
      permissions: ['read', 'write', 'delete'],
    };

    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should create a role successfully', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      roleRepo.findOne.mockResolvedValue(null);
      permissionRepo.find.mockResolvedValue([]);
      permissionRepo.create.mockReturnValue([{ action: 'read' }]);
      permissionRepo.save.mockResolvedValue([{ action: 'read' }]);
      roleRepo.create.mockReturnValue(createRoleDto);
      roleRepo.save.mockResolvedValue(createRoleDto);

      const result = await service.create(createRoleDto, '1');

      expect(result.name).toEqual(createRoleDto.name);
      expect(roleRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user is not admin', async () => {
      const notAdmin = { ...admin, isAdmin: false };
      adminRepo.findOne.mockResolvedValue(notAdmin);

      await expect(service.create(createRoleDto, '1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if role already exists', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      roleRepo.findOne.mockResolvedValue(createRoleDto);

      await expect(service.create(createRoleDto, '1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
