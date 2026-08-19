import { Test, TestingModule } from '@nestjs/testing';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { UserAuthGuard } from '../admin/guard/auth.guard';

const mockRolesService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('RolesController', () => {
  let controller: RolesController;
  let service: any;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        {
          provide: RolesService,
          useFactory: mockRolesService,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(UserAuthGuard)
      .useValue({ canActivate: () => true });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<RolesController>(RolesController);
    service = module.get<RolesService>(RolesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a role', async () => {
      const createRoleDto = { name: 'Admin', permissions: ['read', 'write'] };
      service.create.mockResolvedValue(createRoleDto);

      const result = await controller.create(createRoleDto, { userId: '1' });
      expect(result.name).toEqual(createRoleDto.name);
      expect(service.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all roles', async () => {
      const roles = [{ id: 1, name: 'Admin' }];
      service.findAll.mockResolvedValue(roles);

      const result = await controller.findAll();
      expect(result).toEqual(roles);
    });
  });

  describe('findOne', () => {
    it('should return a single role', async () => {
      const role = { id: 1, name: 'Admin' };
      service.findOne.mockResolvedValue(role);

      const result = await controller.findOne('1');
      expect(result).toEqual(role);
    });
  });

  describe('update', () => {
    it('should update a role', async () => {
      const updateRoleDto = { name: 'Updated Admin' };
      service.update.mockResolvedValue(updateRoleDto);

      const result = await controller.update('1', updateRoleDto, {
        userId: '1',
      });
      expect(result.name).toEqual(updateRoleDto.name);
    });
  });

  describe('remove', () => {
    it('should remove a role', async () => {
      service.remove.mockResolvedValue({});
      await controller.remove('1', { userId: '1' });
      expect(service.remove).toHaveBeenCalled();
    });
  });
});
