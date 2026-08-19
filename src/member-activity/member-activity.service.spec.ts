import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MemberActivityService } from './member-activity.service';
import { MemberActivity } from './entities/member-activity.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Repository } from 'typeorm';

describe('MemberActivityService', () => {
  let service: MemberActivityService;
  let activityRepo: Repository<MemberActivity>;
  let staffRepo: Repository<Staff>;

  const mockActivityRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockStaffRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberActivityService,
        {
          provide: getRepositoryToken(MemberActivity),
          useValue: mockActivityRepo,
        },
        {
          provide: getRepositoryToken(Staff),
          useValue: mockStaffRepo,
        },
      ],
    }).compile();

    service = module.get<MemberActivityService>(MemberActivityService);
    activityRepo = module.get<Repository<MemberActivity>>(getRepositoryToken(MemberActivity));
    staffRepo = module.get<Repository<Staff>>(getRepositoryToken(Staff));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logActivity', () => {
    it('should log activity with parsed browser and device from User-Agent', async () => {
      const mockStaff = { id: 1, lastIpAddress: '127.0.0.1', address: { city: 'Lagos', state: 'Nigeria' } };
      staffRepo.findOne = jest.fn().mockResolvedValue(mockStaff);
      activityRepo.create = jest.fn().mockImplementation((dto) => dto);
      activityRepo.save = jest.fn().mockImplementation((dto) => Promise.resolve({ id: 'uuid', ...dto }));

      const mockReq = {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'x-forwarded-for': '192.168.1.1',
        },
        socket: {},
      } as any;

      const result = await service.logActivity(1, 'LOGIN', 'Success', mockReq);

      expect(result.browser).toContain('Chrome on Windows');
      expect(result.deviceType).toBe('Desktop');
      expect(result.ipAddress).toBe('192.168.1.1');
      expect(result.location).toBe('Lagos, Nigeria');
      expect(activityRepo.save).toHaveBeenCalled();
    });

    it('should log mobile device from User-Agent', async () => {
      staffRepo.findOne = jest.fn().mockResolvedValue(null);
      activityRepo.create = jest.fn().mockImplementation((dto) => dto);
      activityRepo.save = jest.fn().mockImplementation((dto) => Promise.resolve(dto));

      const mockReq = {
        headers: {
          'user-agent': 'Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Mobile Safari/537.36',
        },
        socket: { remoteAddress: '8.8.8.8' },
      } as any;

      const result = await service.logActivity(1, 'VIEW_TASKS', 'Success', mockReq);

      expect(result.deviceType).toBe('Mobile');
      expect(result.browser).toContain('Chrome on Android');
      expect(result.ipAddress).toBe('8.8.8.8');
    });

    it('should use staff profile info if request is missing', async () => {
      const mockStaff = { 
        id: 1, 
        lastIpAddress: '10.0.0.5', 
        address: { city: 'Abuja', state: 'FCT' } 
      };
      staffRepo.findOne = jest.fn().mockResolvedValue(mockStaff);
      activityRepo.create = jest.fn().mockImplementation((dto) => dto);
      activityRepo.save = jest.fn().mockImplementation((dto) => Promise.resolve(dto));

      const result = await service.logActivity(1, 'UPDATE_PROFILE', 'Success');

      expect(result.ipAddress).toBe('10.0.0.5');
      expect(result.location).toBe('Abuja, FCT');
      expect(result.deviceType).toBe('Unknown');
    });
  });

  describe('getActivityStats', () => {
    it('should return correct success and failed counts', async () => {
      const queryBuilder: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn(),
      };

      mockActivityRepo.createQueryBuilder = jest.fn().mockReturnValue(queryBuilder);
      
      // First getCount for total
      queryBuilder.getCount.mockResolvedValueOnce(10);
      // Second getCount for success
      queryBuilder.getCount.mockResolvedValueOnce(7);

      const stats = await service.getActivityStats(1);

      expect(stats).toEqual({
        total: 10,
        success: 7,
        failed: 3,
      });
      expect(queryBuilder.where).toHaveBeenCalledWith('activity.staffId = :staffId', { staffId: 1 });
    });
  });
});
