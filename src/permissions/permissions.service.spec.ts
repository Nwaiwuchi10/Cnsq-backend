import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsService } from './permissions.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Permission } from './entities/permission.entity';
import { Admin } from '../admin/entities/admin.entity';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

describe('PermissionsService', () => {
  let service: PermissionsService;
  let permissionRepo: any;
  let adminRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        { provide: getRepositoryToken(Permission), useFactory: mockRepository },
        { provide: getRepositoryToken(Admin), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    permissionRepo = module.get(getRepositoryToken(Permission));
    adminRepo = module.get(getRepositoryToken(Admin));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createPermissionDto = {
      action: 'read',
      description: 'Read permission',
    };

    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should create a permission successfully', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      permissionRepo.findOne.mockResolvedValue(null);
      permissionRepo.create.mockReturnValue(createPermissionDto);
      permissionRepo.save.mockResolvedValue(createPermissionDto);

      const result = await service.create(createPermissionDto, '1');

      expect(result.action).toEqual(createPermissionDto.action);
      expect(permissionRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user is not admin', async () => {
      const notAdmin = { ...admin, isAdmin: false };
      adminRepo.findOne.mockResolvedValue(notAdmin);

      await expect(service.create(createPermissionDto, '1')).rejects.toThrow(
        'Only Admins are Authorized to peform task',
      );
    });
  });

  describe('findAll', () => {
    it('should return all permissions', async () => {
      const permissions = [
        { id: 1, action: 'read' },
        { id: 2, action: 'write' },
      ];
      permissionRepo.find.mockResolvedValue(permissions);

      const result = await service.findAll();

      expect(result).toEqual(permissions);
      expect(permissionRepo.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single permission', async () => {
      const permission = { id: 1, action: 'read' };
      permissionRepo.findOne.mockResolvedValue(permission);

      const result = await service.findOne(1);

      expect(result).toEqual(permission);
    });

    it('should throw NotFoundException if permission not found', async () => {
      permissionRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(
        'Permission not found',
      );
    });
  });

  describe('update', () => {
    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should update a permission successfully', async () => {
      const updateDto = { action: 'write' };
      const permission = { id: 1, action: 'read' };

      adminRepo.findOne.mockResolvedValue(admin);
      permissionRepo.findOne.mockResolvedValue(permission);
      permissionRepo.save.mockResolvedValue({ ...permission, ...updateDto });

      const result = await service.update(1, updateDto, '1');

      expect(permissionRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should remove a permission', async () => {
      const permission = { id: 1, action: 'read' };
      adminRepo.findOne.mockResolvedValue(admin);
      permissionRepo.findOne.mockResolvedValue(permission);
      permissionRepo.remove.mockResolvedValue({});

      const result = await service.remove(1, '1');

      expect(result.message).toBeDefined();
    });

    it('should throw NotFoundException if permission not found', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      permissionRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999, '1')).rejects.toThrow(
        'Permission id not found',
      );
    });
  });
});
