import { Test, TestingModule } from '@nestjs/testing';
import { StaffRegisterService } from './staff-register.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Staff } from './entities/staff-register.entity';
import { StaffAddress } from './entities/staf-adress.entity';
import { StaffEmployment } from './entities/staff-employment.entity';
import { Department } from '../departments/entities/department.entity';
import { DepartmentalRole } from '../departmental-role/entities/departmental-role.entity';
import { Admin } from '../admin/entities/admin.entity';
import { Role } from '../roles/entities/role.entity';
import { MailService } from './service/mail.service';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { StaffRegisterDto } from './dto/create-staff-register.dto';

describe('StaffRegisterService', () => {
  let service: StaffRegisterService;
  let staffRepo: Repository<Staff>;
  let departmentRepo: Repository<Department>;
  let roleRepo: Repository<DepartmentalRole>;
  let adminRepo: Repository<Admin>;
  let mailService: MailService;
  let dataSource: DataSource;

  const mockStaffRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockReturnValue([[], 0]),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockReturnValue([]),
      getCount: jest.fn().mockReturnValue(0),
    })),
  };

  const mockAdminRepo = {
    findOne: jest.fn(),
  };

  const mockDepartmentRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    count: jest.fn(),
  };

  const mockRoleRepo = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
  };

  const mockEmploymentRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockReturnValue(0),
    })),
  };

  const mockAddressRepo = {
    create: jest.fn(),
  };

  const mockRolesPermissionRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockMailService = {
    staffOnboardingMail: jest.fn(),
    staffLoginMail: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb) => cb({
      findOne: jest.fn().mockImplementation((entity, criteria) => {
        if (entity === Staff && criteria.where.email) {
          return mockStaffRepo.findOne({ where: { email: criteria.where.email } });
        }
        if (entity === Staff && criteria.where.phone) {
          return mockStaffRepo.findOne({ where: { phone: criteria.where.phone } });
        }
        if (entity === StaffEmployment) {
          return mockEmploymentRepo.findOne(criteria);
        }
        return null;
      }),
      create: jest.fn().mockImplementation((entity, dto) => {
        return { ...dto }; // Simple pass-through
      }),
      save: jest.fn().mockResolvedValue({ id: 1 }),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StaffRegisterService,
        { provide: getRepositoryToken(Staff), useValue: mockStaffRepo },
        { provide: getRepositoryToken(StaffAddress), useValue: mockAddressRepo },
        { provide: getRepositoryToken(StaffEmployment), useValue: mockEmploymentRepo },
        { provide: getRepositoryToken(Department), useValue: mockDepartmentRepo },
        { provide: getRepositoryToken(DepartmentalRole), useValue: mockRoleRepo },
        { provide: getRepositoryToken(Admin), useValue: mockAdminRepo },
        { provide: getRepositoryToken(Role), useValue: mockRolesPermissionRepo },
        { provide: MailService, useValue: mockMailService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<StaffRegisterService>(StaffRegisterService);
    staffRepo = module.get<Repository<Staff>>(getRepositoryToken(Staff));
    departmentRepo = module.get<Repository<Department>>(getRepositoryToken(Department));
    roleRepo = module.get<Repository<DepartmentalRole>>(getRepositoryToken(DepartmentalRole));
    adminRepo = module.get<Repository<Admin>>(getRepositoryToken(Admin));
    mailService = module.get<MailService>(MailService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('it should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto: StaffRegisterDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '1234567890',
      employment: {
        departmentId: 1,
        departmentalRoleId: 1,
        // other fields
      } as any,
      address: {} as any,
      // other fields
    } as StaffRegisterDto;

    const file = {
      location: 'http://s3.location/img.jpg',
    } as any;

    it('should create a staff member successfully when admin initiates', async () => {
      mockAdminRepo.findOne.mockResolvedValue({ id: 1, isAdmin: true });
      mockStaffRepo.findOne.mockResolvedValue(null); // No existing email/phone
      mockDepartmentRepo.findOne.mockResolvedValue({ id: 1, name: 'IT' });
      mockRoleRepo.findOne.mockResolvedValue({ id: 1, title: 'Dev' });

      // Mock transaction execution handled in mockDataSource definition currently

      const result = await service.create(createDto, '1', file);

      expect(mockAdminRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockDepartmentRepo.findOne).toHaveBeenCalled();
      expect(mockRoleRepo.findOne).toHaveBeenCalled();
      expect(mockDataSource.transaction).toHaveBeenCalled();
      // Since transaction mock returns a resolved value
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if not admin and not hiring manager', async () => {
      mockAdminRepo.findOne.mockResolvedValue(null); // Not admin
      mockStaffRepo.findOne.mockResolvedValue({
        id: 2,
        roles: [] // No 'Hiring Manager' role
      });

      await expect(service.create(createDto, '2', file)).rejects.toThrow(BadRequestException);
    });

    it('should create staff if user is Hiring Manager', async () => {
      mockAdminRepo.findOne.mockResolvedValue(null);
      mockStaffRepo.findOne.mockImplementation((args) => {
        // This is checking if the USER (initiator) exists
        if (args.where.id === 2) {
          return Promise.resolve({
            id: 2,
            roles: [{ name: 'Hiring Manager' }]
          })
        }
        // This is checking if new staff email exists (inside transaction) -> handled by transaction mock
        return Promise.resolve(null);
      });

      mockDepartmentRepo.findOne.mockResolvedValue({ id: 1 });
      mockRoleRepo.findOne.mockResolvedValue({ id: 1 });

      const result = await service.create(createDto, '2', file);

      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return an array of staff', async () => {
      const staffArray = [new Staff(), new Staff()];
      mockStaffRepo.find.mockResolvedValue(staffArray);

      const result = await service.findAll();

      expect(result).toEqual(staffArray);
      expect(mockStaffRepo.find).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a staff member by ID', async () => {
      const staff = new Staff();
      mockStaffRepo.findOne.mockResolvedValue(staff);

      const result = await service.findOne(1);

      expect(result).toEqual(staff);
      expect(mockStaffRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException if staff not found', async () => {
      mockStaffRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('should throw NotFoundException if staff not found', async () => {
      mockStaffRepo.findOne.mockResolvedValue(null);
      await expect(service.updateProfile(1, {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a staff member', async () => {
      mockStaffRepo.findOne.mockResolvedValue(new Staff());
      mockStaffRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(1);

      expect(result).toEqual({ message: 'Delete successful' });
      expect(mockStaffRepo.delete).toHaveBeenCalledWith(1);
    });

    it('should throw NotFoundException if staff to delete is not found', async () => {
      mockStaffRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
