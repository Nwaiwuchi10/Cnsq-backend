import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UserAuthGuard } from './guard/auth.guard';

const mockAdminService = () => ({
  create: jest.fn(),
  login: jest.fn(),
  promoteStaffToAdmin: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('AdminController', () => {
  let controller: AdminController;
  let service: AdminService;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: mockAdminService(),
        },
      ],
    });

    moduleBuilder
      .overrideGuard(UserAuthGuard)
      .useValue({ canActivate: () => true });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<AdminController>(AdminController);
    service = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a new admin', async () => {
      const createAdminDto = {
        email: 'admin@test.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      jest.spyOn(service, 'create').mockResolvedValue(createAdminDto as any);

      const result = await controller.create(createAdminDto);

      expect(result.email).toEqual(createAdminDto.email);
    });
  });

  describe('login', () => {
    it('should login an admin', async () => {
      const loginDto = {
        email: 'admin@test.com',
        password: 'password123',
      };

      const loginResult = {
        id: 1,
        email: loginDto.email,
        token: 'jwt_token',
      };

      jest.spyOn(service, 'login').mockResolvedValue(loginResult as any);

      const result = await controller.login(loginDto);

      expect(result.token).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return an array of admins with pagination', async () => {
      const mockResult = {
        data: [{ id: 1, email: 'admin@test.com' }],
        total: 1,
        page: 1,
        limit: 10,
      };

      jest.spyOn(service, 'findAll').mockResolvedValue(mockResult as any);

      const result = await controller.findAll(1, 10);

      expect(result.data).toBeDefined();
      expect(result.total).toEqual(1);
    });
  });

  describe('findOne', () => {
    it('should return a single admin', async () => {
      const admin = { id: 1, email: 'admin@test.com' };
      jest.spyOn(service, 'findOne').mockResolvedValue(admin as any);

      const result = await controller.findOne('1');

      expect(result.email).toEqual(admin.email);
    });
  });

  // describe('update', () => {
  //   it('should update an admin', async () => {
  //     const updateAdminDto = { firstName: 'Jane' };
  //     const updated: any = {
  //       ...updateAdminDto,
  //       id: 1,
  //       email: 'admin@test.com',
  //     };

  //     jest.spyOn(service, 'update').mockResolvedValue(updated);

  //     const result = await controller.update('1', updateAdminDto);

  //     expect((result as any).firstName).toEqual(updateAdminDto.firstName);
  //   });
  // });

  describe('remove', () => {
    it('should remove an admin', async () => {
      jest.spyOn(service, 'remove').mockResolvedValue({ message: 'Removed' });

      const mockReq = { userId: '1' };
      await controller.remove('1', mockReq);

      expect(service.remove).toHaveBeenCalledWith(1, '1');
    });
  });

  describe('promoteStaffToAdmin', () => {
    it('should promote staff to admin', async () => {
      const promoted = {
        id: 2,
        email: 'staff@test.com',
        isAdmin: true,
      };

      jest
        .spyOn(service, 'promoteStaffToAdmin')
        .mockResolvedValue(promoted as any);

      const req = { userId: '1' };
      const result = await controller.promoteStaffToAdmin(1, req);

      expect(result.isAdmin).toBe(true);
    });
  });
});
