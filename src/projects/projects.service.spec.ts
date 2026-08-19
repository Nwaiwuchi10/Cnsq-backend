import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ProjectsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            updateProject: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('project methods', () => {
    it('should have create method', () => {
      expect(typeof service.create).toBe('function');
    });

    it('should have findAll method', () => {
      expect(typeof service.findAll).toBe('function');
    });
  });

  describe('findAll', () => {
    it('should return an array of projects', async () => {
      const projects = [{ id: 1, projectName: 'P1' }];
      projectRepo.find.mockResolvedValue(projects);

      const result = await service.findAll();
      expect(result).toEqual(projects);
    });
  });

  describe('findOne', () => {
    it('should return a project if found', async () => {
      const project = { id: 1, projectName: 'P1' };
      projectRepo.findOne.mockResolvedValue(project);

      const result = await service.findOne(1);
      expect(result).toEqual(project);
    });

    it('should throw NotFoundException if not found', async () => {
      projectRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProject', () => {
    const dto: UpdateProjectDto = { projectName: 'Updated P1' };
    const userId = '1';

    it('should update a project successfully', async () => {
      adminRepo.findOne.mockResolvedValue({ id: 1, isAdmin: true });
      projectRepo.findOne.mockResolvedValue({ 
        id: 1, 
        projectName: 'P1', 
        assignedTo: [] 
      });
      projectRepo.save.mockResolvedValue({ id: 1, ...dto });

      const result = await service.updateProject(1, dto, userId);
      expect(result).toEqual({ id: 1, ...dto });
      expect(notificationService.createNotificationsForStaffs).toHaveBeenCalled();
    });
  });

  describe('assignMultipleStaff', () => {
    it('should assign multiple staff to a project', async () => {
        const userId = '1';
        adminRepo.findOne.mockResolvedValue({ id: 1, isAdmin: true });
        projectRepo.findOne.mockResolvedValue({ id: 1, projectName: 'P1' });
        staffRepo.findOne.mockResolvedValue({ id: 2, firstName: 'Staff' });
        assignmentRepo.findOne.mockResolvedValue(null);
        assignmentRepo.create.mockReturnValue({ project: { id: 1 }, staff: { id: 2 }, role: 'Dev' });
        assignmentRepo.save.mockResolvedValue({ project: { id: 1 }, staff: { id: 2 }, role: 'Dev' });

        const assignments = [{ staffId: 2, role: 'Dev' }];
        const result = await service.assignMultipleStaff(1, assignments, userId);
        
        expect(result).toHaveLength(1);
        expect(notificationService.createNotificationForStaff).toHaveBeenCalled();
        expect(mailService.sendAssignmentMail).toHaveBeenCalled();
    });
  });

  describe('addComment', () => {
    it('should add a comment if staff is assigned', async () => {
       projectRepo.findOne.mockResolvedValue({ id: 1, projectName: 'P1' });
       staffRepo.findOne.mockResolvedValue({ id: 2, firstName: 'Staff' });
       assignmentRepo.findOne.mockResolvedValue({ project: { id: 1 }, staff: { id: 2 } });
       commentRepo.create.mockReturnValue({ text: 'comment' });
       commentRepo.save.mockResolvedValue({ text: 'comment' });
       assignmentRepo.find.mockResolvedValue([{ staff: { id: 2 } }]);

       const result = await service.addComment(1, 2, 'comment');
       expect(result).toEqual({ text: 'comment' });
    });

    it('should throw ForbiddenException if staff is not assigned', async () => {
       projectRepo.findOne.mockResolvedValue({ id: 1 });
       staffRepo.findOne.mockResolvedValue({ id: 2 });
       assignmentRepo.findOne.mockResolvedValue(null);

       await expect(service.addComment(1, 2, 'comment')).rejects.toThrow(ForbiddenException);
    });
  });
    describe('getUserProjects', () => {
        it('should return created projects', async () => {
            projectRepo.find.mockResolvedValue([{ id: 1 }]);
            const result = await service.getUserProjects(1, 'created');
            expect(result).toHaveLength(1);
        });
    });

    describe('getProjectStats', () => {
        it('should return project stats', async () => {
            projectRepo.count.mockResolvedValueOnce(10) // total
                             .mockResolvedValueOnce(5)  // active
                             .mockResolvedValueOnce(3)  // completed
                             .mockResolvedValueOnce(2); // planning
            
            const result = await service.getProjectStats();
            expect(result).toEqual({
                total: 10,
                active: 5,
                completed: 3,
                planning: 2,
            });
        });
    });
});
