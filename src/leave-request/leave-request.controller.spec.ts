import { Test, TestingModule } from '@nestjs/testing';
import { LeaveRequestController } from './leave-request.controller';
import { LeaveRequestService } from './leave-request.service';
import { LeaveType } from './entities/leave-request.entity';

describe('LeaveRequestController', () => {
  let controller: LeaveRequestController;
  let service: LeaveRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeaveRequestController],
      providers: [
        {
          provide: LeaveRequestService,
          useValue: {
            create: jest.fn(),
            findAllForUser: jest.fn(),
            findOne: jest.fn(),
            updateStatus: jest.fn(),
            getStats: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<LeaveRequestController>(LeaveRequestController);
    service = module.get<LeaveRequestService>(LeaveRequestService);
  });

  it('should be defined', () => {
     expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create', async () => {
      const dto = {
        leaveType: LeaveType.ANNUAL,
        startDate: '2025-12-20',
        endDate: '2025-12-31',
        reason: 'Vacation',
        handoverStaffId: 3,
        supervisorId: 2,
      };
      const req = { staffId: 1 };
      await controller.create(dto, req);
      expect(service.create).toHaveBeenCalledWith(dto, 1);
    });
  });

  describe('findAllForUser', () => {
    it('should call service.findAllForUser', async () => {
      const req = { staffId: 1 };
      await controller.findAllForUser(req);
      expect(service.findAllForUser).toHaveBeenCalledWith(1);
    });
  });
});
