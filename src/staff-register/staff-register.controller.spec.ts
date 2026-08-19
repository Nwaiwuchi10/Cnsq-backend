import { Test, TestingModule } from '@nestjs/testing';
import { StaffRegisterController } from './staff-register.controller';
import { StaffRegisterService } from './staff-register.service';
import { StaffRegisterDto } from './dto/create-staff-register.dto';
import { UpdateStaffDto } from './dto/Update-staff-profile.dto';
import { Staff } from './entities/staff-register.entity';
import { CanActivate } from '@nestjs/common';
import { StaffAuthGuard } from './guard/staff.guard';
import { UserAuthGuard } from '../admin/guard/auth.guard';
import { StaffOrAdminAuthGuard } from './guard/staff-admin-guard';
import { PermissionGuard } from './guard/PermissionGuard/permission-guard';

const mockGuard: CanActivate = {
  canActivate: jest.fn(() => true),
};

describe('StaffRegisterController', () => {
  let controller: StaffRegisterController;
  let service: StaffRegisterService;

  const mockStaffRegisterService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateProfile: jest.fn(),
    remove: jest.fn(),
    findStaffByuuid: jest.fn(),
    FindStaff: jest.fn(),
    changePassword: jest.fn(),
    getAllStaffswithDepartments: jest.fn(),
    getAllStaffs: jest.fn(),
    getTodayBirthdays: jest.fn(),
    getThisWeekBirthdays: jest.fn(),
    getThisMonthBirthdays: jest.fn(),
    getAllBirthdayCelebrants: jest.fn(),
    getYearlyAnniversaries: jest.fn(),
    getQuarterlyAnniversaries: jest.fn(),
    getAllAnniversaries: jest.fn(),
    getStats: jest.fn(),
    getUpcomingBirthdays: jest.fn(),
    getUpcomingAnniversaries: jest.fn(),
    getRecentAnniversaries: jest.fn(),
    findTodaysBirthdays: jest.fn(),
    findTodaysAnniversary: jest.fn(),
    findThisMonthAnniversary: jest.fn(),
    assignRoles: jest.fn(),
    removeRole: jest.fn(),
    getStaffByDepartmentOrRoleOrJobTitle: jest.fn(),
    populateMissingUuids: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    softDeleteStaff: jest.fn(),
    restoreStaff: jest.fn(),
    findDeletedStaff: jest.fn(),
    loginStaff: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StaffRegisterController],
      providers: [
        {
          provide: StaffRegisterService,
          useValue: mockStaffRegisterService,
        },
      ],
    })
      .overrideGuard(StaffAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(UserAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(StaffOrAdminAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(PermissionGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<StaffRegisterController>(StaffRegisterController);
    service = module.get<StaffRegisterService>(StaffRegisterService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a staff member', async () => {
      const dto = '{ "email": "test@test.com" }';
      const file = { originalname: 'test.jpg' } as any;
      const req = { userId: '1' };
      const expectedResult = new Staff();

      mockStaffRegisterService.create.mockResolvedValue(expectedResult);

      const result = await controller.create(file, dto, req);

      expect(result).toBe(expectedResult);
      expect(mockStaffRegisterService.create).toHaveBeenCalledWith(
        JSON.parse(dto),
        '1',
        file,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of staff', async () => {
      const result = [new Staff()];
      mockStaffRegisterService.findAll.mockResolvedValue(result);

      expect(await controller.findAll()).toBe(result);
    });
  });

  describe('findOne', () => {
    it('should return a single staff member', async () => {
      const result = new Staff();
      mockStaffRegisterService.findOne.mockResolvedValue(result);

      expect(await controller.findOne('1')).toBe(result);
      expect(mockStaffRegisterService.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe('updateProfile', () => {
    it('should update a staff profile', async () => {
      const id = 1;
      const dto = '{ "firstName": "Updated" }';
      const file = { originalname: 'test.jpg' } as any;
      const parsedDto = JSON.parse(dto);
      const expectedResult = new Staff();

      mockStaffRegisterService.updateProfile.mockResolvedValue(expectedResult);

      const result = await controller.updateProfile(file, id, dto);

      expect(result).toBe(expectedResult);
      expect(mockStaffRegisterService.updateProfile).toHaveBeenCalledWith(
        id,
        parsedDto,
        file,
      );
    });
  });

  describe('remove', () => {
    it('should remove a staff member', async () => {
      const id = '1';
      const expectedResult = { message: 'Delete successful' };

      mockStaffRegisterService.remove.mockResolvedValue(expectedResult);

      expect(await controller.remove(id)).toBe(expectedResult);
      expect(mockStaffRegisterService.remove).toHaveBeenCalledWith(1);
    });
  });
});
