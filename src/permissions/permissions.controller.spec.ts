import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { UserAuthGuard } from '../admin/guard/auth.guard';

const mockPermissionsService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('PermissionsController', () => {
  let controller: PermissionsController;
  let service: any;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        {
          provide: PermissionsService,
          useFactory: mockPermissionsService,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(UserAuthGuard)
      .useValue({ canActivate: () => true });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<PermissionsController>(PermissionsController);
    service = module.get<PermissionsService>(PermissionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a permission', async () => {
      const createPermissionDto = { action: 'read' };
      service.create.mockResolvedValue(createPermissionDto);

      const result = await controller.create(createPermissionDto, {
        userId: '1',
      });
      expect(result.action).toEqual(createPermissionDto.action);
    });
  });

  describe('findAll', () => {
    it('should return all permissions', async () => {
      const permissions = [{ id: 1, action: 'read' }];
      service.findAll.mockResolvedValue(permissions);

      const result = await controller.findAll();
      expect(result).toEqual(permissions);
    });
  });

  describe('findOne', () => {
    it('should return a single permission', async () => {
      const permission = { id: 1, action: 'read' };
      service.findOne.mockResolvedValue(permission);

      const result = await controller.findOne('1');
      expect(result).toEqual(permission);
    });
  });

  describe('remove', () => {
    it('should remove a permission', async () => {
      service.remove.mockResolvedValue({});
      await controller.remove('1', { userId: '1' });
      expect(service.remove).toHaveBeenCalled();
    });
  });
});
