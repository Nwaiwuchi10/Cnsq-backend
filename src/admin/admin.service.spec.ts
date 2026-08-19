import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Admin } from './entities/admin.entity';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

const mockJwtService = () => ({
  sign: jest.fn(),
  verify: jest.fn(),
});

describe('AdminService', () => {
  let service: AdminService;
  let adminRepo: any;
  let staffRepo: any;
  let jwtService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Admin), useFactory: mockRepository },
        { provide: getRepositoryToken(Staff), useFactory: mockRepository },
        { provide: JwtService, useFactory: mockJwtService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    adminRepo = module.get(getRepositoryToken(Admin));
    staffRepo = module.get(getRepositoryToken(Staff));
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createAdminDto = {
      email: 'admin@test.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      isAdmin: true,
    };

    it('should create a new admin successfully', async () => {
      adminRepo.findOne.mockResolvedValue(null);
      adminRepo.create.mockReturnValue(createAdminDto);
      adminRepo.save.mockResolvedValue(createAdminDto);
      jwtService.sign.mockReturnValue('token123');

      const result = await service.create(createAdminDto);

      expect(result.email).toEqual(createAdminDto.email);
      expect(result.firstName).toEqual(createAdminDto.firstName);
      expect(adminRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if email already exists', async () => {
      adminRepo.findOne.mockResolvedValue(createAdminDto);

      await expect(service.create(createAdminDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'admin@test.com',
      password: 'password123',
    };

    const admin = {
      id: 1,
      email: 'admin@test.com',
      password: '$2a$10$hashedpassword',
      firstName: 'John',
      lastName: 'Doe',
      isAdmin: true,
    };

    it('should login successfully with valid credentials', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(true as never));
      jwtService.sign.mockReturnValue('token123');

      const result = await service.login(loginDto);

      expect(result.email).toEqual(loginDto.email);
      expect(result.token).toBeDefined();
    });

    it('should throw NotFoundException if email not found', async () => {
      adminRepo.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if password is incorrect', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      jest
        .spyOn(bcrypt, 'compare')
        .mockImplementation(() => Promise.resolve(false as never));

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('promoteStaffToAdmin', () => {
    const staffId = 1;
    const userId = '1';

    const admin = {
      id: 1,
      email: 'admin@test.com',
      firstName: 'John',
      lastName: 'Doe',
      isAdmin: true,
    };

    const staff = {
      id: 1,
      email: 'staff@test.com',
      firstName: 'Jane',
      lastName: 'Smith',
      password: 'hashedpassword',
    };

    it('should promote staff to admin successfully', async () => {
      adminRepo.findOne
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(null);
      staffRepo.findOne.mockResolvedValue(staff);
      adminRepo.create.mockReturnValue({ ...staff, isAdmin: true });
      adminRepo.save.mockResolvedValue({ ...staff, isAdmin: true });
      jwtService.sign.mockReturnValue('token123');

      const result = await service.promoteStaffToAdmin(staffId, userId);

      expect(result.email).toEqual(staff.email);
      expect(adminRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user is not admin', async () => {
      const notAdmin = { ...admin, isAdmin: false };
      adminRepo.findOne.mockResolvedValue(notAdmin);

      await expect(
        service.promoteStaffToAdmin(staffId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if staff not found', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      staffRepo.findOne.mockResolvedValue(null);

      await expect(
        service.promoteStaffToAdmin(staffId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if staff is already admin', async () => {
      adminRepo.findOne
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(staff);
      staffRepo.findOne.mockResolvedValue(staff);

      await expect(
        service.promoteStaffToAdmin(staffId, userId),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
