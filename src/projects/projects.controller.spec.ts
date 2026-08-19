import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { DataSource } from 'typeorm';
import { StaffAuthGuard } from '../staff-register/guard/staff.guard';
import { StaffOrAdminAuthGuard } from '../staff-register/guard/staff-admin-guard';

describe('ProjectsController', () => {
  let controller: ProjectsController;

  beforeEach(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [ProjectsController],
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
        {
          provide: DataSource,
          useValue: {
            getRepository: jest.fn(),
          },
        },
      ],
    });

    moduleBuilder
      .overrideGuard(StaffOrAdminAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(StaffAuthGuard)
      .useValue({ canActivate: () => true });

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<ProjectsController>(ProjectsController);
  });

  it('it should be defined', () => {
    expect(controller).toBeDefined();
  });
});
