import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from './task.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskAssignment } from './entities/task-asessment.entity';
import { Project } from '../projects/entities/project.entity';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { ProjectAssignment } from '../projects/entities/project-assessment.entity';
import { TaskComment } from './entities/task-comments.entity';
import { DataSource } from 'typeorm';
import { TaskMailService } from './service/mail.service';
import { NotificationService } from '../notification/notification.service';
import { PushNotificationService } from '../push-notification/push-notification.service';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

describe('TaskService', () => {
  let service: TaskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        { provide: getRepositoryToken(Task), useFactory: mockRepository },
        {
          provide: getRepositoryToken(TaskAssignment),
          useFactory: mockRepository,
        },
        { provide: getRepositoryToken(Project), useFactory: mockRepository },
        { provide: getRepositoryToken(Staff), useFactory: mockRepository },
        {
          provide: getRepositoryToken(ProjectAssignment),
          useFactory: mockRepository,
        },
        {
          provide: getRepositoryToken(TaskComment),
          useFactory: mockRepository,
        },
        { provide: DataSource, useValue: { getRepository: jest.fn() } },
        {
          provide: TaskMailService,
          useValue: { sendNotification: jest.fn() },
        },
        {
          provide: NotificationService,
          useValue: { createNotifications: jest.fn() },
        },
        {
          provide: PushNotificationService,
          useValue: { sendNotification: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
