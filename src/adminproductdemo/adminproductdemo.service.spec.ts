import { Test, TestingModule } from '@nestjs/testing';
import { AdminproductdemoService } from './adminproductdemo.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Adminproductdemo } from './entities/adminproductdemo.entity';
import { Admin } from '../admin/entities/admin.entity';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { NotificationService } from '../notification/notification.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

const mockNotificationService = () => ({
  createNotifications: jest.fn(),
});

describe('AdminproductdemoService', () => {
  let service: AdminproductdemoService;
  let demoRepo: any;
  let adminRepo: any;
  let staffRepo: any;
  let notificationService: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminproductdemoService,
        {
          provide: getRepositoryToken(Adminproductdemo),
          useFactory: mockRepository,
        },
        { provide: getRepositoryToken(Admin), useFactory: mockRepository },
        { provide: getRepositoryToken(Staff), useFactory: mockRepository },
        { provide: NotificationService, useFactory: mockNotificationService },
      ],
    }).compile();

    service = module.get<AdminproductdemoService>(AdminproductdemoService);
    demoRepo = module.get(getRepositoryToken(Adminproductdemo));
    adminRepo = module.get(getRepositoryToken(Admin));
    staffRepo = module.get(getRepositoryToken(Staff));
    notificationService = module.get(NotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDemoDto = {
      nameOfProduct: 'Demo Product',
      description: 'Product demonstration',
      howItWorks: 'Step by step guide',
      createdById: 1,
    };

    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should create a product demo successfully', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      demoRepo.create.mockReturnValue(createDemoDto);
      demoRepo.save.mockResolvedValue(createDemoDto);

      const result = await service.create(createDemoDto, admin.id);

      expect(result.nameOfProduct).toEqual(createDemoDto.nameOfProduct);
      expect(demoRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if admin not found', async () => {
      adminRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createDemoDto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of product demos', async () => {
      const demos = [
        { id: 1, nameOfProduct: 'Demo 1' },
        { id: 2, nameOfProduct: 'Demo 2' },
      ];
      demoRepo.find.mockResolvedValue(demos);

      const result = await service.findAll({ page: 0, limit: 10 });

      expect(result).toEqual(demos);
    });
  });

  describe('findOne', () => {
    it('should return a single product demo', async () => {
      const demo = { id: 1, name: 'Demo 1' };
      demoRepo.findOne.mockResolvedValue(demo);

      const result = await service.findOne(1);

      expect(result).toEqual(demo);
    });

    it('should throw NotFoundException if demo not found', async () => {
      demoRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should remove a product demo successfully', async () => {
      const demo = { id: 1, nameOfProduct: 'Demo 1' };
      adminRepo.findOne.mockResolvedValue(admin);
      demoRepo.findOne.mockResolvedValue(demo);
      demoRepo.remove.mockResolvedValue({});

      const result = await service.remove(1);

      expect(result).toEqual({ message: expect.any(String) });
    });
  });
});
