import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from '../entities/task.entity';

@Injectable()
export class ProjectCompletionService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  async isProjectCompleted(projectId: number): Promise<boolean> {
    const tasks = await this.taskRepo.find({
      where: { project: { id: projectId } },
    });

    if (tasks.length === 0) {
      return false; // No tasks, not considered completed
    }

    const completedStatuses = [
      TaskStatus.Dev_COMPLETED,      // 'Passed_Test'
      TaskStatus.Dev_Setup_Completed, // 'Dev_Completed'
      TaskStatus.COMPLETED,
    ];

    return tasks.every((task) => completedStatuses.includes(task.status));
  }
}
