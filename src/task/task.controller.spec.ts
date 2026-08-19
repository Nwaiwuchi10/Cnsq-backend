import { Test, TestingModule } from '@nestjs/testing';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { CanActivate } from '@nestjs/common';
import { StaffAuthGuard } from '../staff-register/guard/staff.guard';

const mockTaskService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
};

const mockGuard: CanActivate = {
  canActivate: jest.fn(() => true),
};

describe('TaskController', () => {
  let controller: TaskController;
  let service: TaskService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [{ provide: TaskService, useValue: mockTaskService }],
    })
      .overrideGuard(StaffAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<TaskController>(TaskController);
    service = module.get<TaskService>(TaskService);
  });

  it('it should be defined', () => {
    expect(controller).toBeDefined();
  });
});
