import { Test, TestingModule } from '@nestjs/testing';
import { LeaveRequestService } from './leave-request.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { LeaveRequest, LeaveStatus, LeaveType } from './entities/leave-request.entity';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { MailService } from '../staff-register/service/mail.service';
import { NotFoundException } from '@nestjs/common';

describe('LeaveRequestService', () => {
  let service: LeaveRequestService;
  let leaveRequestRepo;
  let staffRepo;
  let mailService;

  const mockStaff = { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com' };
  const mockSupervisor = { id: 2, firstName: 'Boss', lastName: 'Man', email: 'boss@example.com' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestService,
        {
          provide: getRepositoryToken(LeaveRequest),
          useValue: {
            create: jest.fn().mockImplementation(dto => dto),
            save: jest.fn().mockImplementation(req => Promise.resolve({ id: 1, ...req })),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Staff),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendLeaveRequestToSupervisor: jest.fn(),
            sendLeaveStatusUpdate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LeaveRequestService>(LeaveRequestService);
    leaveRequestRepo = module.get(getRepositoryToken(LeaveRequest));
    staffRepo = module.get(getRepositoryToken(Staff));
    mailService = module.get(MailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a leave request and send emails to all supervisors', async () => {
      const dto = {
        leaveType: LeaveType.ANNUAL,
        startDate: '2025-12-20',
        endDate: '2025-12-31',
        reason: 'Vacation',
        handoverStaffId: 3,
        supervisorIds: [2, 4],
      };

      staffRepo.findOne.mockResolvedValueOnce(mockStaff); // requester
      leaveRequestRepo.find = jest.fn().mockResolvedValueOnce([mockSupervisor, { id: 4, email: 'boss2@example.com' }]); // Mocking multiple supervisors search
      // Re-mocking find because we use find for supervisors array
      staffRepo.find = jest.fn().mockResolvedValueOnce([mockSupervisor, { id: 4, email: 'boss2@example.com' }]);
      staffRepo.findOne.mockResolvedValueOnce({ id: 3 }); // handover staff

      const result = await service.create(dto as any, 1, undefined);

      expect(result).toBeDefined();
      expect(result.durationDays).toBe(12);
      expect(mailService.sendLeaveRequestToSupervisor).toHaveBeenCalledTimes(2);
      expect(leaveRequestRepo.save).toHaveBeenCalled();
    });

    it('should throw error if staff not found', async () => {
      staffRepo.findOne.mockResolvedValue(null);
      await expect(service.create({} as any, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update status and send email', async () => {
      const mockRequest = { id: 'uuid-123', staff: mockStaff, status: LeaveStatus.PENDING };
      leaveRequestRepo.findOne.mockResolvedValue(mockRequest);

      const result = await service.updateStatus('uuid-123', { status: LeaveStatus.APPROVED, reviewNotes: 'Enjoy!' }, 2);

      expect(result.status).toBe(LeaveStatus.APPROVED);
      expect(mailService.sendLeaveStatusUpdate).toHaveBeenCalledWith(mockStaff, LeaveStatus.APPROVED, 'Enjoy!');
    });
  });

  describe('findAllForSupervisor', () => {
    it('should call query builder to find requests', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      leaveRequestRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);

      await service.findAllForSupervisor(2);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('supervisors.id = :supervisorId', { supervisorId: 2 });
    });
  });

  describe('getAdminStats', () => {
    it('should return aggregated stats', async () => {
      leaveRequestRepo.find.mockResolvedValue([
        { status: LeaveStatus.PENDING },
        { status: LeaveStatus.APPROVED },
      ]);

      const stats = await service.getAdminStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(1);
      expect(stats.approved).toBe(1);
    });
  });
});
