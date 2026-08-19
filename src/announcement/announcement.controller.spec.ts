import { Test, TestingModule } from '@nestjs/testing';
import { AnnouncementController } from './announcement.controller';
import { AnnouncementService } from './announcement.service';
import { UserAuthGuard } from '../admin/guard/auth.guard';
import { StaffAuthGuard } from '../staff-register/guard/staff.guard';

const mockAnnouncementService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  markAsRead: jest.fn(),
});

describe('AnnouncementController', () => {
  let controller: AnnouncementController;
  let service: any;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AnnouncementController],
      providers: [
        {
          provide: AnnouncementService,
          useFactory: mockAnnouncementService,
        },
      ],
    });

    moduleBuilder
      .overrideGuard(UserAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(StaffAuthGuard)
      .useValue({ canActivate: () => true });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<AnnouncementController>(AnnouncementController);
    service = module.get<AnnouncementService>(AnnouncementService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an announcement', async () => {
      const createAnnouncementDto = {
        title: 'Meeting',
        description: 'Important',
      };
      service.create.mockResolvedValue(createAnnouncementDto);

      const result = await controller.create(createAnnouncementDto, {
        userId: 1,
      });
      expect(result.title).toEqual(createAnnouncementDto.title);
    });
  });

  describe('operations', () => {
    it('should have getAll method', () => {
      expect(typeof controller.getAll).toBe('function');
    });

    it('should have findOne method', () => {
      expect(typeof controller.findOne).toBe('function');
    });

    it('should have remove method', () => {
      expect(typeof controller.remove).toBe('function');
    });
  });
});
