import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import {
  PriorityLevel,
  Task,
  TaskStatus,
  URGENCY,
} from './entities/task.entity';
import { InjectRepository } from '@nestjs/typeorm';

import { DataSource, In, LessThanOrEqual, Not, Repository } from 'typeorm';
import { Project } from 'src/projects/entities/project.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { TaskAssignment } from './entities/task-asessment.entity';
import { TaskComment } from './entities/task-comments.entity';
import { AddCommentDto, EditCommentDto } from './dto/task-comments.dto';
import { TaskMailService } from './service/mail.service';
import { ProjectAssignment } from 'src/projects/entities/project-assessment.entity';
import { Department } from 'src/departments/entities/department.entity';
import { HeadOfDepartment } from 'src/headofdepartment/entities/headofdepartment.entity';
import * as csvParser from 'csv-parser';
import axios from 'axios';
import { PassThrough } from 'stream';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { NotificationType } from 'src/notification/entities/notification.entity';
import { NotificationService } from 'src/notification/notification.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import * as webpush from 'web-push';
import { ProjectCompletionService } from './service/project-completion.service';
import { MemberActivityService } from 'src/member-activity/member-activity.service';
const AWS_S3_BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'your-bucket';
const s3Client = new S3Client({ region: process.env.AWS_REGION });

type BulkCreateOptions = {
  projectId: string;
  uploadedFile?: Express.Multer.File;
  googleSheetUrl?: string;
  uploaderStaffId: number;
  authToken?: string;
};
webpush.setVapidDetails(
  `mailto:${process.env.ADMIN_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);
@Injectable()
export class TaskService {
  constructor(
    @InjectRepository(Task) private taskRepo: Repository<Task>,
    @InjectRepository(TaskAssignment)
    private assignmentRepo: Repository<TaskAssignment>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Staff) private staffRepo: Repository<Staff>,
    @InjectRepository(ProjectAssignment)
    private readonly projectAssignmentRepo: Repository<ProjectAssignment>,

    @InjectRepository(TaskComment)
    private readonly commentRepo: Repository<TaskComment>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(HeadOfDepartment)
    private readonly hodRepo: Repository<HeadOfDepartment>,
    private readonly dataSource: DataSource,
    private taskMailService: TaskMailService,
    private notificationService: NotificationService,
    private pushNotificationService: PushNotificationService,
    private projectCompletionService: ProjectCompletionService,
    private readonly activityService: MemberActivityService,
  ) { }
  ////

  /////
  private async checkPreviousSprintStatus(
    sprint: number,
    staffIds: number[],
    projectId?: number,
    departmentId?: number,
  ): Promise<void> {
    if (sprint <= 1 || !staffIds.length) return;

    const previousSprint = sprint - 1;

    // Allowed statuses for the previous sprint
    const allowedStatuses = [
      TaskStatus.READY_TO_TEST,
      TaskStatus.TESTIN_IN_PROGRESS,
      TaskStatus.Dev_COMPLETED, // 'Passed_Test*'
      TaskStatus.Dev_Setup_Completed, // 'Dev_Completed'
      TaskStatus.COMPLETED,
    ];

    const queryBuilder = this.taskRepo
      .createQueryBuilder('task')
      .innerJoin('task.assignedTo', 'assignment')
      .innerJoin('assignment.staff', 'staff')
      .where('task.sprint = :previousSprint', { previousSprint })
      .andWhere('staff.id IN (:...staffIds)', { staffIds });

    if (projectId) {
      queryBuilder.andWhere('task.projectId = :projectId', { projectId });
    } else {
      queryBuilder.andWhere('task.projectId IS NULL');
    }

    if (departmentId) {
      queryBuilder.andWhere('task.departmentId = :departmentId', {
        departmentId,
      });
    }

    const unfinishedTasks = await queryBuilder
      .andWhere('task.status NOT IN (:...allowedStatuses)', { allowedStatuses })
      .getMany();

    if (unfinishedTasks.length > 0) {
      const unfinishedTitles = [
        ...new Set(unfinishedTasks.map((t) => `"${t.title}" (${t.status})`)),
      ].join(', ');
      throw new BadRequestException(
        `Cannot create task for Sprint ${sprint}. Assigned staff have unfinished tasks in Sprint ${previousSprint}: ${unfinishedTitles}. All tasks for assigned staff in the previous sprint must be Ready to Test, Testing, Passed Test, or Completed.`,
      );
    }
  }

  async create(dto: CreateTaskDto, staffId: number): Promise<Task> {
    if (dto.title.length < 3 || dto.title.length > 255) {
      throw new BadRequestException(
        'Title must be between 3 and 255 characters',
      );
    }
    // Check for duplicate
    const queryBuilder = this.taskRepo
      .createQueryBuilder('task')
      .where('task.title = :title', { title: dto.title });

    if (dto.projectId) {
      queryBuilder.andWhere('task.projectId = :projectId', {
        projectId: dto.projectId,
      });
    } else {
      queryBuilder.andWhere('task.projectId IS NULL');
    }

    const taskExist = await queryBuilder.getOne();

    if (taskExist) {
      throw new BadRequestException(
        dto.projectId
          ? 'A task with this title already exists in this project.'
          : 'A task with this title already exists outside of any project.',
      );
    }

    // Ensure project exists (if provided)
    let project: Project | null = null;
    let isCompletedProject = false;
    if (dto.projectId) {
      project = await this.projectRepo.findOne({
        where: { id: dto.projectId },
      });
      if (!project) {
        throw new NotFoundException('Project not found');
      }

      // ✅ Restrict: only staff assigned to this project can create a task (if project is provided)
      const isAssigned = await this.projectAssignmentRepo.findOne({
        where: {
          project: { id: project.id },
          staff: { id: staffId },
        },
      });

      if (!isAssigned) {
        throw new ForbiddenException(
          'You are not assigned to this project and cannot create tasks for it.',
        );
      }

      isCompletedProject = await this.projectCompletionService.isProjectCompleted(project.id);
    }

    const creator = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!creator) throw new NotFoundException('Staff not found');

    // Ensure department exists (if provided)
    let department: Department | null = null;
    if (dto.departmentId) {
      department = await this.departmentRepo.findOne({
        where: { id: dto.departmentId },
      });
      if (!department) {
        throw new NotFoundException('Department not found');
      }
    }

    if (dto.sprint && dto.sprint > 1) {
      const assignedStaffIds = dto.assignedTo?.map((a) => a.staffId) || [];
      await this.checkPreviousSprintStatus(
        dto.sprint,
        assignedStaffIds,
        dto.projectId,
        dto.departmentId,
      );
    }

    if (dto.startDate && dto.dueDate && new Date(dto.dueDate) < new Date(dto.startDate)) {
      throw new BadRequestException('Due date cannot be before start date');
    }

    // Create the task
    const task = this.taskRepo.create({
      title: dto.title,
      description: dto.description,
      taskModule: dto.taskModule,
      status: dto.status ?? TaskStatus.NOT_STARTED,
      priority: dto.priority ?? PriorityLevel.Medium,
      urgency: dto.urgency ?? URGENCY.SHORT_TERM,
      dueDate: dto.dueDate,
      startDate: dto.startDate,
      timeline: dto.timeline,
      sprint: dto.sprint,
      project: (project && !isCompletedProject) ? project : undefined,
      linkedProjectId: (project && isCompletedProject) ? project.id : undefined,
      department: department || undefined,
      createdBy: creator,
    });

    const savedTask: Task = (await this.taskRepo.save(task)) as Task;

    // Assign staff if provided
    if (dto.assignedTo?.length) {
      const assignments = await Promise.all(
        dto.assignedTo.map(async (a) => {
          const staff = await this.staffRepo.findOne({
            where: { id: a.staffId },
          });
          if (!staff) {
            throw new NotFoundException(`Staff with id ${a.staffId} not found`);
          }
          await this.taskMailService.sendTaskCreatedMail(
            staff,
            savedTask,
            a.role,
          );
          return this.assignmentRepo.create({
            task: savedTask,
            staff,
            role: a.role,
          });
        }),
      );

      await this.assignmentRepo.save(assignments);
      savedTask.assignedTo = assignments;
    }

    // Log activity
    await this.activityService.logActivity(
      staffId,
      `Created Task: ${savedTask.title}`,
      'Success',
      undefined,
      String(savedTask.id),
    );

    return savedTask;
  }

  findAll(projectId?: number, departmentId?: number): Promise<Task[]> {
    const where: any = {};
    if (projectId) {
      where.project = { id: projectId };
    }
    if (departmentId) {
      where.department = { id: departmentId };
    }
    return this.taskRepo.find({
      where,
      relations: [
        'assignedTo',
        'assignedTo.staff',
        'project',
        'department',
        'createdBy',
        'comments',
        'comments.staff',
        'comments.mentionedStaff',
      ],
    });
  }

  async findOne(id: number): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: [
        'assignedTo',
        'assignedTo.staff',
        'project',
        'department',
        'createdBy',
        'comments',
        'comments.staff',
        'comments.mentionedStaff',
      ],
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }
  async updateOld(
    id: number,
    dto: UpdateTaskDto,
    staffId: number,
  ): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['project', 'assignedTo', 'assignedTo.staff'],
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.project) {
      const isAssigned = await this.projectAssignmentRepo.findOne({
        where: {
          project: { id: task.project.id },
          staff: { id: staffId },
        },
      });

      if (!isAssigned) {
        throw new ForbiddenException(
          'You are not assigned to this project and cannot update its tasks.',
        );
      }
    } else {
      // Personal task: only creator or assigned staff can update
      const isAssignee = task.assignedTo?.some((a) => a.staff.id === staffId);
      const isCreator = task.createdBy?.id === staffId;

      if (!isAssignee && !isCreator) {
        throw new ForbiddenException(
          'You are not authorized to update this personal task.',
        );
      }
    }
    Object.assign(task, dto);

    if (task.startDate && task.dueDate && new Date(task.dueDate) < new Date(task.startDate)) {
      throw new BadRequestException('Due date cannot be before start date');
    }

    const updatedTask = await this.taskRepo.save(task);

    if (dto.assignedTo) {
      await this.assignmentRepo.delete({ task: { id } });

      const assignments = await Promise.all(
        dto.assignedTo.map(async (a) => {
          const staff = await this.staffRepo.findOne({
            where: { id: a.staffId },
          });
          if (!staff)
            throw new NotFoundException(`Staff ${a.staffId} not found`);

          // Send update email
          await this.taskMailService.sendTaskUpdatedMail(staff, updatedTask);

          return this.assignmentRepo.create({
            task: updatedTask,
            staff,
            role: a.role,
          });
        }),
      );

      await this.assignmentRepo.save(assignments);
      task.assignedTo = assignments;
    } else {
      // notify all existing assigned staff
      for (const assignment of task.assignedTo ?? []) {
        await this.taskMailService.sendTaskUpdatedMail(
          assignment.staff,
          updatedTask,
        );
      }
    }
    //  Notify all assigned staff (excluding updater)
    const assignedStaffs = (task.assignedTo ?? [])
      .map((a) => a.staff)
      .filter((s) => s.id !== staffId);

    if (assignedStaffs.length > 0) {
      const title = `Task updated: ${updatedTask.title}`;
      const message = `Task ${updatedTask.title} has been updated. Status: ${updatedTask.status}.`;
      await this.notificationService.createNotificationsForStaffs(
        assignedStaffs,
        NotificationType.Task_UPDATE,
        title,
        message,
        updatedTask.project,
      );
    }
    return updatedTask;
  }

  async update(id: number, dto: UpdateTaskDto, staffId: number): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['project', 'assignedTo', 'assignedTo.staff'],
    });

    if (!task) throw new NotFoundException('Task not found');

    // Ensure staff has access (if task belongs to a project)
    if (task.project) {
      const isAssigned = await this.projectAssignmentRepo.findOne({
        where: {
          project: { id: task.project.id },
          staff: { id: staffId },
        },
      });

      if (!isAssigned) {
        throw new ForbiddenException(
          'You are not assigned to this project and cannot update its tasks.',
        );
      }
    } else {
      // If task is personal (no project), only creator or assigned staff can update
      const isAssignee = task.assignedTo?.some((a) => a.staff.id === staffId);
      const isCreator = task.createdBy?.id === staffId;

      if (!isAssignee && !isCreator) {
        throw new ForbiddenException(
          'You are not authorized to update this personal task.',
        );
      }
    }

    // Only update fields that were actually provided
    const updatableFields = [
      'title',
      'description',
      'taskModule',
      'status',
      'priority',
      'urgency',
      'timeline',
      'startDate',
      'dueDate',
      'sprint',
      'departmentId',
      'projectId',
    ];

    for (const field of updatableFields) {
      const newValue = (dto as any)[field];
      if (newValue !== undefined && newValue !== null && newValue !== '') {
        if (field === 'departmentId') {
          const dept = await this.departmentRepo.findOne({
            where: { id: newValue },
          });
          if (dept) {
            task.department = dept;
          }
        } else if (field === 'projectId') {
          const proj = await this.projectRepo.findOne({
            where: { id: newValue },
          });
          if (proj) {
            // ✅ Enforce project assignment check
            const isAssigned = await this.projectAssignmentRepo.findOne({
              where: {
                project: { id: proj.id },
                staff: { id: staffId },
              },
            });
            if (!isAssigned) {
              throw new ForbiddenException(
                'You are not assigned to this project and cannot link tasks to it.',
              );
            }

            const isCompleted = await this.projectCompletionService.isProjectCompleted(proj.id);
            if (isCompleted) {
              task.project = undefined;
              task.linkedProjectId = proj.id;
            } else {
              task.project = proj;
              task.linkedProjectId = undefined;
            }
          }
        } else {
          (task as any)[field] = newValue;
        }
      } else if (newValue === null || newValue === '') {
        if (field === 'projectId') {
          task.project = undefined;
          task.linkedProjectId = undefined;
        }
      }
    }

    // Date validation after updates
    if (task.startDate && task.dueDate && new Date(task.dueDate) < new Date(task.startDate)) {
      throw new BadRequestException('Due date cannot be before start date');
    }

    const updatedTask = await this.taskRepo.save(task);

    // Handle assignments if provided
    if (dto.assignedTo && dto.assignedTo.length > 0) {
      // Delete old assignments first
      await this.assignmentRepo.delete({ task: { id } });

      const assignments = await Promise.all(
        dto.assignedTo.map(async (a) => {
          const staff = await this.staffRepo.findOne({
            where: { id: a.staffId },
          });
          if (!staff)
            throw new NotFoundException(`Staff ${a.staffId} not found`);

          await this.taskMailService.sendTaskUpdatedMail(staff, updatedTask);

          return this.assignmentRepo.create({
            task: updatedTask,
            staff,
            role: a.role,
          });
        }),
      );

      await this.assignmentRepo.save(assignments);
      task.assignedTo = assignments;
    } else {
      // No assignedTo in DTO: keep existing ones, just notify them
      for (const assignment of task.assignedTo ?? []) {
        await this.taskMailService.sendTaskUpdatedMail(
          assignment.staff,
          updatedTask,
        );
      }
    }

    //Notify all assigned staff (excluding the updater)
    const assignedStaffs = (task.assignedTo ?? [])
      .map((a) => a.staff)
      .filter((s) => s.id !== staffId);

    if (assignedStaffs.length > 0) {
      const title = `Task updated: ${updatedTask.title}`;
      const message = `Task ${updatedTask.title} has been updated. Status: ${updatedTask.status}.`;
      await this.notificationService.createNotificationsForStaffs(
        assignedStaffs,
        NotificationType.Task_UPDATE,
        title,
        message,
        updatedTask.project,
      );
    }

    // Log activity
    await this.activityService.logActivity(
      staffId,
      `Updated Task: ${updatedTask.title} (Status: ${updatedTask.status})`,
      'Success',
      undefined,
      String(updatedTask.id),
    );

    return updatedTask;
  }

  async updated(id: number, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);

    Object.assign(task, dto);

    if (task.startDate && task.dueDate && new Date(task.dueDate) < new Date(task.startDate)) {
      throw new BadRequestException('Due date cannot be before start date');
    }

    await this.taskRepo.save(task);

    if (dto.assignedTo) {
      // remove old assignments
      await this.assignmentRepo.delete({ task: { id } });

      // add new ones
      const assignments = await Promise.all(
        dto.assignedTo.map(async (a) => {
          const staff = await this.staffRepo.findOne({
            where: { id: a.staffId },
          });
          if (!staff)
            throw new NotFoundException(`Staff with id ${a.staffId} not found`);
          await this.taskMailService.sendTaskUpdatedMail(staff, task);
          return this.assignmentRepo.create({
            task,
            staff,
            role: a.role,
          });
        }),
      );
      await this.assignmentRepo.save(assignments);
      task.assignedTo = assignments;
    }

    return task;
  }

  async remove(id: number): Promise<void> {
    const task = await this.findOne(id);
    await this.taskRepo.remove(task);
  }

  //  Extra endpoint: Get all tasks for a staff//
  async findByStaff(staffId: number): Promise<Task[]> {
    const staff = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff not found');

    const assignments = await this.assignmentRepo.find({
      where: { staff: { id: staffId } },
      relations: ['task', 'task.project', 'task.department', 'task.createdBy'],
    });

    return assignments.map((a) => a.task);
  }

  async addComment(
    taskId: number,
    staffId: number,
    dto: AddCommentDto,
  ): Promise<TaskComment> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['project'],
    });
    if (!task) throw new NotFoundException('Task not found');

    const staff = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff not found');
    // Check if staff is authorized
    if (task.project) {
      const isAssigned = await this.projectAssignmentRepo.findOne({
        where: {
          project: { id: task.project.id },
          staff: { id: staffId },
        },
      });

      if (!isAssigned) {
        throw new ForbiddenException(
          'You are not assigned to this project and cannot comment on its tasks.',
        );
      }
    } else {
      // Personal task: only creator or assigned staff can comment
      const isAssignee = task.assignedTo?.some((a) => a.staff.id === staffId);
      const isCreator = task.createdBy?.id === staffId;

      if (!isAssignee && !isCreator) {
        throw new ForbiddenException(
          'You are not authorized to comment on this personal task.',
        );
      }
    }

    let mentionedStaff: Staff | null = null;
    if (dto.mentionedStaffId) {
      mentionedStaff = await this.staffRepo.findOne({
        where: { id: dto.mentionedStaffId },
      });
      if (!mentionedStaff)
        throw new NotFoundException('Mentioned staff not found');
    }

    const comment = this.commentRepo.create({
      task,
      staff,
      mentionedStaff: mentionedStaff ?? undefined,
      text: dto.text,
    });

    const savedComment = await this.commentRepo.save(comment);

    // Reload task with comments to reflect changes
    await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['comments', 'comments.staff', 'comments.mentionedStaff'],
    });
    // Send mention email if applicable
    if (mentionedStaff) {
      await this.taskMailService.sendMentionMail(
        mentionedStaff,
        savedComment,
        task,
      );
      const title = `You were mentioned in a comment`;
      const message = `${staff.firstName} mentioned you in a comment on task ${task.title}.`;
      await this.notificationService.createNotificationForStaff(
        mentionedStaff,
        NotificationType.Task_COMMENT,
        title,
        message,
        task.project,
      );

      // 🔔 WEB PUSH NOTIFICATION
      try {
        const subs = await this.pushNotificationService.getByUser(
          mentionedStaff.id,
        );

        if (!subs || subs.length === 0) {
          console.log(`No push subscriptions for user ${mentionedStaff.id}`);
        } else {
          const payload = JSON.stringify({
            title: `Mentioned on task: ${task.title}`,
            body: `${staff.firstName} mentioned you in a comment`,
            url: task.project
              ? `/project/${task.project.id}`
              : `/tasks/${task.id}`, // frontend deep link
            type: 'task_comment',
          });

          await Promise.all(
            subs.map((sub) =>
              webpush.sendNotification(sub.data, payload).catch((err) => {
                console.error(
                  `Push failed for user ${mentionedStaff.id}, subscription ${sub.id}`,
                  err,
                );
              }),
            ),
          );
        }
      } catch (err) {
        console.error('Task comment push notification error:', err);
      }
    }
    // ✅ Notify other assigned staff (excluding commenter & mentioned staff)
    const otherAssignedStaffs = (task.assignedTo ?? [])
      .map((a) => a.staff)
      .filter(
        (s) =>
          s.id !== staff.id && (!mentionedStaff || s.id !== mentionedStaff.id),
      );

    if (otherAssignedStaffs.length > 0) {
      const title = `New comment on task: ${task.title}`;
      const message = `${staff.firstName} commented on task "${task.title}".`;
      await this.notificationService.createNotificationsForStaffs(
        otherAssignedStaffs,
        NotificationType.Task_COMMENT,
        title,
        message,
        task.project,
      );
    }
    return savedComment;
  }

  async getAllSprints(): Promise<number[]> {
    const result = await this.taskRepo
      .createQueryBuilder('task')
      .select('DISTINCT task.sprint', 'sprint')
      .orderBy('task.sprint', 'ASC')
      .getRawMany();

    return result.map((row) => row.sprint);
  }

  // src/tasks/task.service.ts

  async editComment(
    commentId: number,
    staffId: number,
    dto: EditCommentDto,
  ): Promise<TaskComment> {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
      relations: ['staff'],
    });
    if (!comment) throw new NotFoundException('Comment not found');

    // only owner can edit
    if (comment.staff.id !== staffId) {
      throw new ForbiddenException('You can only edit your own comment.');
    }

    comment.text = dto.text ?? comment.text;
    return await this.commentRepo.save(comment);
  }

  async deleteComment(
    commentId: number,
    staffId: number,
  ): Promise<{ message: string }> {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
      relations: ['staff'],
    });
    if (!comment) throw new NotFoundException('Comment not found');

    if (comment.staff.id !== staffId) {
      throw new ForbiddenException('You can only delete your own comments.');
    }

    await this.commentRepo.remove(comment);
    return {
      message: 'Delete successful',
    };
  }

  // src/tasks/task.service.ts

  async attachFileToComment(
    commentId: number,
    staffId: number,
    text: string,
    file: Express.Multer.File,
  ): Promise<TaskComment> {
    const comment = await this.commentRepo.findOne({
      where: { id: commentId },
      relations: ['staff'],
    });
    if (!comment) throw new NotFoundException('Comment not found');

    if (comment.staff.id !== staffId) {
      throw new ForbiddenException(
        'You can only attach files to your own comments.',
      );
    }

    const s3File = file as Express.Multer.File & { location?: string };
    if (!s3File.location) {
      throw new BadRequestException(
        'File upload to S3 failed: location missing',
      );
    }

    ((comment.fileUrl = s3File.location), (comment.text = text));
    return await this.commentRepo.save(comment);
  }
  // Get timeline view of tasks for a staff

  async getStaffTaskTimeline(staffId: number) {
    const assignments = await this.assignmentRepo.find({
      where: { staff: { id: staffId } },
      relations: ['task', 'task.project', 'task.department'],
    });

    if (assignments.length === 0) {
      throw new NotFoundException('No tasks assigned to this staff');
    }

    // Format tasks for timeline view
    return assignments.map((assignment) => {
      const task = assignment.task;
      return {
        taskId: task.id,
        title: task.title,
        project: task.project?.projectName || 'Personal Task',
        status: task.status,
        priority: task.priority,
        urgency: task.urgency,
        startDate: task.startDate,
        dueDate: task.dueDate,
        timeline: task.timeline,
        role: assignment.role,
      };
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async checkTaskDeadlines() {
    const now = new Date();
    const upcomingThreshold = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours ahead

    // Find tasks due soon or overdue (but not completed)
    const tasks = await this.taskRepo.find({
      where: [
        {
          dueDate: LessThanOrEqual(upcomingThreshold),
          status: Not(In([TaskStatus.COMPLETED, TaskStatus.Dev_COMPLETED])),
        },
      ],
      relations: ['assignedTo', 'assignedTo.staff', 'project'],
    });

    for (const task of tasks) {
      if (!task.dueDate) continue;

      const dueInHours =
        (task.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      let title: string;
      let message: string;

      // Notify if task is overdue
      if (dueInHours <= 0) {
        title = `Task overdue: ${task.title}`;
        message = `Task: ${task.title} is overdue since ${task.dueDate.toLocaleString()}. Please take action.`;
      }
      // Notify if due within 6 hours
      else if (dueInHours <= 6) {
        title = `Task deadline approaching: ${task.title}`;
        message = `Task: ${task.title} is due within 6 hours (${task.dueDate.toLocaleString()}).`;
      } else {
        continue;
      }

      const assignedStaffs = task.assignedTo.map((a) => a.staff);

      if (assignedStaffs.length > 0) {
        await this.notificationService.createNotificationsForStaffs(
          assignedStaffs,
          NotificationType.DEADLINE,
          title,
          message,
          task.project,
        );
      }
    }
  }

  async deleteTask(taskId: number, staffId: number): Promise<string> {
    // 1. Fetch task with relations
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['assignedTo', 'project', 'project.createdBy'],
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const project = task.project;

    // 2. Permission validation
    if (project) {
      // 3. Check if staff is PROJECT ASSIGNEE
      const isProjectAssignee = await this.projectAssignmentRepo.findOne({
        where: {
          project: { id: project.id },
          staff: { id: staffId },
        },
      });

      // 4. Check if staff is the PROJECT CREATOR
      const isProjectCreator = project.createdBy?.id === staffId;

      // 5. Check if staff is assigned to THIS TASK
      const isTaskAssignee = task.assignedTo?.some(
        (a) => a.staff.id === staffId,
      );

      if (!isTaskAssignee && !isProjectAssignee && !isProjectCreator) {
        throw new ForbiddenException(
          'You are not assigned to this project or task.',
        );
      }
    } else {
      // Personal task: only creator or assigned staff can delete
      const isTaskAssignee = task.assignedTo?.some(
        (a) => a.staff.id === staffId,
      );
      const isCreator = task.createdBy?.id === staffId;

      if (!isTaskAssignee && !isCreator) {
        throw new ForbiddenException(
          'You are not authorized to delete this task.',
        );
      }
    }

    // 6. Delete task
    await this.taskRepo.remove(task);

    return 'Task deleted successfully';
  }
  async getStaffTasksByProjects(
    staffId: number,
    projectId: number,
  ): Promise<Task[]> {
    const tasks = await this.taskRepo
      .createQueryBuilder('task')
      .innerJoinAndSelect('task.assignedTo', 'assignment')
      .innerJoinAndSelect('assignment.staff', 'staff')
      .innerJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.department', 'department')
      .leftJoinAndSelect('task.comments', 'comments')
      .where('staff.id = :staffId', { staffId })
      .andWhere('project.id = :projectId', { projectId })
      .orderBy('task.sprint', 'ASC')
      .addOrderBy('task.id', 'ASC')
      .getMany();

    if (!tasks.length) {
      throw new NotFoundException(
        `No tasks found for staffId ${staffId} in projectId ${projectId}`,
      );
    }

    return tasks;
  }
  async findByProjectWithDateFilter(
    projectId: number,
    year?: number,
    month?: number,
    day?: number,
    status?: string,
    priority?: string,
    urgency?: string,
    pageNum: number = 1,
    limitNum: number = 50,
    search?: string,
  ): Promise<any> {
    const query = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('assignedTo.staff', 'staff')
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.department', 'department')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .leftJoinAndSelect('task.comments', 'comments')
      .leftJoinAndSelect('comments.staff', 'commentStaff')
      .leftJoinAndSelect('comments.mentionedStaff', 'mentionedStaff')
      .where('project.id = :projectId', { projectId });

    /***
     * Date Filtering Logic
     * Uses createdAt
     **/
    if (year) {
      query.andWhere('EXTRACT(YEAR FROM task.createdAt) = :year', { year });
    }

    if (month) {
      query.andWhere('EXTRACT(MONTH FROM task.createdAt) = :month', { month });
    }

    if (day) {
      query.andWhere('EXTRACT(DAY FROM task.createdAt) = :day', { day });
    }

    if (status) {
      query.andWhere('task.status = :status', { status });
    }

    if (priority) {
      query.andWhere('task.priority = :priority', { priority });
    }

    if (urgency) {
      query.andWhere('task.urgency = :urgency', { urgency });
    }

    if (search && search.trim()) {
      query.andWhere(
        '(task.title ILIKE :search OR task.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    query.orderBy('task.sprint', 'ASC').addOrderBy('task.createdAt', 'DESC');

    const totalCount = await query.getCount();

    if (pageNum && limitNum) {
      query.skip((pageNum - 1) * limitNum).take(limitNum);
    }

    const tasks = await query.getMany();
    const totalPages = limitNum ? Math.ceil(totalCount / limitNum) : 1;

    return {
      data: tasks,
      pagination: {
        currentPage: pageNum,
        pageSize: limitNum,
        totalCount,
        totalPages,
      },
    };
  }

  async findByProject(
    projectId: number,
    filters?: {
      year?: number;
      month?: number;
      day?: number;
      status?: string;
      priority?: string;
      urgency?: string;
    },
  ): Promise<Task[]> {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedTo', 'assignedTo')
      .leftJoinAndSelect('assignedTo.staff', 'staff')
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.department', 'department')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .leftJoinAndSelect('task.comments', 'comments')
      .leftJoinAndSelect('comments.staff', 'commentStaff')
      .leftJoinAndSelect('comments.mentionedStaff', 'mentionedStaff')
      .where('project.id = :projectId', { projectId });

    if (filters?.year) {
      qb.andWhere('EXTRACT(YEAR FROM task.createdAt) = :year', {
        year: filters.year,
      });
    }

    if (filters?.month) {
      qb.andWhere('EXTRACT(MONTH FROM task.createdAt) = :month', {
        month: filters.month,
      });
    }

    if (filters?.day) {
      qb.andWhere('EXTRACT(DAY FROM task.createdAt) = :day', {
        day: filters.day,
      });
    }

    if (filters?.status) {
      qb.andWhere('task.status = :status', { status: filters.status });
    }

    if (filters?.priority) {
      qb.andWhere('task.priority = :priority', { priority: filters.priority });
    }

    if (filters?.urgency) {
      qb.andWhere('task.urgency = :urgency', { urgency: filters.urgency });
    }

    qb.orderBy('task.sprint', 'ASC')
      .addOrderBy('task.createdAt', 'DESC')
      .addOrderBy('task.id', 'ASC');

    const tasks = await qb.getMany();
    return tasks;
  }
  async getStaffTasksByProject(
    staffId: number,
    projectId: number,
    filters?: {
      year?: number;
      month?: number;
      day?: number;
      status?: string;
      priority?: string;
      urgency?: string;
    },
    pageNum: number = 1,
    limitNum: number = 50,
    search?: string,
  ): Promise<any> {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .innerJoinAndSelect('task.assignedTo', 'assignment')
      .innerJoinAndSelect('assignment.staff', 'staff')
      .innerJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.department', 'department')
      .leftJoinAndSelect('task.comments', 'comments')
      .where('staff.id = :staffId', { staffId })
      .andWhere('project.id = :projectId', { projectId });

    /**
     * OPTIONAL DATE FILTERING
     * Uses task.createdAt (switch to startDate if needed)
     ***/
    if (filters?.year) {
      qb.andWhere('EXTRACT(YEAR FROM task.createdAt) = :year', {
        year: filters.year,
      });
    }

    if (filters?.month) {
      qb.andWhere('EXTRACT(MONTH FROM task.createdAt) = :month', {
        month: filters.month,
      });
    }

    if (filters?.day) {
      qb.andWhere('EXTRACT(DAY FROM task.createdAt) = :day', {
        day: filters.day,
      });
    }

    if (filters?.status) {
      qb.andWhere('task.status = :status', { status: filters.status });
    }

    if (filters?.priority) {
      qb.andWhere('task.priority = :priority', { priority: filters.priority });
    }

    if (filters?.urgency) {
      qb.andWhere('task.urgency = :urgency', { urgency: filters.urgency });
    }

    if (search && search.trim()) {
      qb.andWhere(
        '(task.title ILIKE :search OR task.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    /**
     * SAME ORDERING AS ORIGINAL ENDPOINT
     */
    qb.orderBy('task.sprint', 'ASC').addOrderBy('task.id', 'ASC');

    const totalCount = await qb.getCount();

    if (pageNum && limitNum) {
      qb.skip((pageNum - 1) * limitNum).take(limitNum);
    }

    const tasks = await qb.getMany();
    const totalPages = limitNum ? Math.ceil(totalCount / limitNum) : 1;

    return {
      data: tasks,
      pagination: {
        currentPage: pageNum,
        pageSize: limitNum,
        totalCount,
        totalPages,
      },
    };
  }

  async getStaffTasksByProjectAndDate(
    projectId: number,
    staffId: number,
    year?: number,
    month?: number,
    day?: number,
  ) {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedTo', 'assignment')
      .leftJoinAndSelect('assignment.staff', 'staff')
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.department', 'department')
      .leftJoinAndSelect('task.comments', 'comments')
      .where('project.id = :projectId', { projectId })
      .andWhere('staff.id = :staffId', { staffId });

    /**
     * DATE FILTERING
     * Using createdAt (change to startDate if needed)
     */
    if (year) {
      qb.andWhere('EXTRACT(YEAR FROM task.createdAt) = :year', { year });
    }

    if (month) {
      qb.andWhere('EXTRACT(MONTH FROM task.createdAt) = :month', { month });
    }

    if (day) {
      qb.andWhere('EXTRACT(DAY FROM task.createdAt) = :day', { day });
    }

    qb.orderBy('task.createdAt', 'DESC');

    return qb.getMany();
  }
  /////login user task with filter

  async findByLoginStaffTask(
    sprint?: number,
    queryStaffId?: any,
    status?: string,
    year?: number,
    month?: number,
    day?: number,
    startDate?: string,
    endDate?: string,
    priority?: string,
    urgency?: string,
    departmentId?: number,
    pageNum: number = 1,
    limitNum: number = 50,
    reqStaffId?: number,
    search?: string,
    projectId?: number,
  ): Promise<any> {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedTo', 'assignment')
      .leftJoinAndSelect('assignment.staff', 'staff')
      .leftJoinAndSelect('staff.employment', 'employment')
      .leftJoinAndSelect('employment.department', 'staffDept')
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.department', 'department')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .leftJoinAndSelect('task.comments', 'comments')
      .leftJoinAndSelect('comments.staff', 'commentStaff')
      .leftJoinAndSelect('comments.mentionedStaff', 'mentionedStaff');

    // Check if logged in staff is HOD
    let HODDeptIds: number[] = [];
    if (reqStaffId) {
      const HODRecords = await this.hodRepo.find({
        where: { staff: { id: reqStaffId } },
        relations: ['department'],
      });
      HODDeptIds = HODRecords.map((r) => r.department?.id).filter(Boolean);
    }

    // Determine staff filter
    let targetStaffId: number | undefined = undefined;
    if (queryStaffId !== undefined && queryStaffId !== 'all') {
      targetStaffId = Number(queryStaffId);
    }

    // Determine department filter
    let targetDeptIds: number[] = [];
    let isDeptFiltered = false;

    if (departmentId) {
      targetDeptIds = [departmentId];
      isDeptFiltered = true;
    } else if (queryStaffId === undefined) {
      // Default load: queryStaffId is not provided
      if (HODDeptIds.length > 0) {
        // If HOD, default to HOD departments
        targetDeptIds = HODDeptIds;
        isDeptFiltered = true;
      } else {
        // If not HOD, default to logged in staff's tasks
        targetStaffId = reqStaffId;
      }
    }

    // Apply filters to query builder
    if (sprint) {
      qb.andWhere('task.sprint = :sprint', { sprint });
    }

    if (targetStaffId) {
      qb.andWhere('staff.id = :targetStaffId', { targetStaffId });
    }

    if (projectId) {
      qb.andWhere('project.id = :projectId', { projectId });
    }

    if (isDeptFiltered && targetDeptIds.length > 0) {
      qb.andWhere('department.id IN (:...targetDeptIds)', { targetDeptIds });
    }

    if (departmentId) {
      qb.andWhere(
        '(task.departmentId = :departmentId OR staffDept.id = :departmentId)',
        { departmentId },
      );
    }

    if (status) {
      qb.andWhere('task.status = :status', { status });
    }

    if (year) {
      qb.andWhere('EXTRACT(YEAR FROM task.createdAt) = :year', { year });
    }
    if (month) {
      qb.andWhere('EXTRACT(MONTH FROM task.createdAt) = :month', { month });
    }
    if (day) {
      qb.andWhere('EXTRACT(DAY FROM task.createdAt) = :day', { day });
    }
    if (startDate) {
      qb.andWhere('task.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('task.createdAt <= :endDate', { endDate });
    }

    if (priority) {
      qb.andWhere('task.priority = :priority', { priority });
    }

    if (urgency) {
      qb.andWhere('task.urgency = :urgency', { urgency });
    }

    if (search && search.trim()) {
      qb.andWhere(
        '(task.title ILIKE :search OR task.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('task.sprint', 'ASC').addOrderBy('task.createdAt', 'DESC');

    const totalCount = await qb.getCount();

    if (pageNum && limitNum) {
      qb.skip((pageNum - 1) * limitNum).take(limitNum);
    }

    let tasks = await qb.getMany();

    // Fallback: If no tasks for the staff, return all tasks
    if (targetStaffId && tasks.length === 0 && pageNum === 1) {
      const hasAnyAssignments = await this.assignmentRepo.count({
        where: { staff: { id: targetStaffId } },
      });

      if (hasAnyAssignments === 0) {
        const allTasksQb = this.taskRepo
          .createQueryBuilder('task')
          .leftJoinAndSelect('task.assignedTo', 'assignment')
          .leftJoinAndSelect('assignment.staff', 'staff')
          .leftJoinAndSelect('staff.employment', 'employment')
          .leftJoinAndSelect('employment.department', 'staffDept')
          .leftJoinAndSelect('task.project', 'project')
          .leftJoinAndSelect('task.department', 'department')
          .leftJoinAndSelect('task.createdBy', 'createdBy')
          .leftJoinAndSelect('task.comments', 'comments')
          .leftJoinAndSelect('comments.staff', 'commentStaff')
          .leftJoinAndSelect('comments.mentionedStaff', 'mentionedStaff')
          .orderBy('task.createdAt', 'DESC');

        if (status) {
          allTasksQb.andWhere('task.status = :status', { status });
        }
        if (sprint) {
          allTasksQb.andWhere('task.sprint = :sprint', { sprint });
        }
        if (departmentId) {
          allTasksQb.andWhere(
            '(task.departmentId = :departmentId OR staffDept.id = :departmentId)',
            { departmentId },
          );
        }
        if (year) {
          allTasksQb.andWhere('EXTRACT(YEAR FROM task.createdAt) = :year', {
            year,
          });
        }
        if (month) {
          allTasksQb.andWhere('EXTRACT(MONTH FROM task.createdAt) = :month', {
            month,
          });
        }
        if (day) {
          allTasksQb.andWhere('EXTRACT(DAY FROM task.createdAt) = :day', {
            day,
          });
        }
        if (startDate) {
          allTasksQb.andWhere('task.createdAt >= :startDate', { startDate });
        }
        if (endDate) {
          allTasksQb.andWhere('task.createdAt <= :endDate', { endDate });
        }

        if (priority) {
          allTasksQb.andWhere('task.priority = :priority', { priority });
        }

        if (urgency) {
          allTasksQb.andWhere('task.urgency = :urgency', { urgency });
        }

        if (isDeptFiltered && targetDeptIds.length > 0) {
          allTasksQb.andWhere('department.id IN (:...targetDeptIds)', {
            targetDeptIds,
          });
        }

        if (projectId) {
          allTasksQb.andWhere('project.id = :projectId', { projectId });
        }

        if (search && search.trim()) {
          allTasksQb.andWhere(
            '(task.title ILIKE :search OR task.description ILIKE :search)',
            { search: `%${search}%` },
          );
        }

        const fallbackTotalCount = await allTasksQb.getCount();

        if (pageNum && limitNum) {
          allTasksQb.skip((pageNum - 1) * limitNum).take(limitNum);
        }

        tasks = await allTasksQb.getMany();

        return {
          data: tasks,
          pagination: {
            currentPage: pageNum,
            pageSize: limitNum,
            totalCount: fallbackTotalCount,
            totalPages: Math.ceil(fallbackTotalCount / limitNum),
          },
        };
      }
    }

    const totalPages = limitNum ? Math.ceil(totalCount / limitNum) : 1;

    return {
      data: tasks,
      pagination: {
        currentPage: pageNum,
        pageSize: limitNum,
        totalCount,
        totalPages,
      },
    };
  }
  ////task by department
  async findByDepartment(
    departmentId: number,
    sprint?: number,
    staffId?: number,
    status?: string,
    priority?: string,
    urgency?: string,
    projectId?: number,
  ): Promise<Task[]> {
    const qb = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.assignedTo', 'assignment')
      .leftJoinAndSelect('assignment.staff', 'staff')
      .leftJoinAndSelect('task.project', 'project')
      .leftJoinAndSelect('task.department', 'department')
      .leftJoinAndSelect('task.createdBy', 'createdBy')
      .leftJoinAndSelect('task.comments', 'comments')
      .leftJoinAndSelect('comments.staff', 'commentStaff')
      .where('department.id = :departmentId', { departmentId });

    if (sprint) {
      qb.andWhere('task.sprint = :sprint', { sprint });
    }

    if (staffId) {
      qb.andWhere('staff.id = :staffId', { staffId });
    }

    if (projectId) {
      qb.andWhere('project.id = :projectId', { projectId });
    }

    if (status) {
      qb.andWhere('task.status = :status', { status });
    }

    if (priority) {
      qb.andWhere('task.priority = :priority', { priority });
    }

    if (urgency) {
      qb.andWhere('task.urgency = :urgency', { urgency });
    }

    qb.orderBy('task.sprint', 'ASC').addOrderBy('task.createdAt', 'DESC');

    const tasks = await qb.getMany();
    return tasks;
  }

  /**
   * GET /task/staff/:staffId/dashboard
   * Returns a full productivity dashboard for one staff member.
   * Powers the "View Task" modal in the Staff Directory UI.
   */
  async getStaffTaskDashboard(staffId: number) {
    // 1. Verify staff exists
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    // 2. Load all task assignments for this staff
    const assignments = await this.assignmentRepo.find({
      where: { staff: { id: staffId } },
      relations: ['task', 'task.project', 'task.department'],
    });

    const tasks = assignments.map((a) => a.task).filter(Boolean);

    // 3. Bucket tasks by status using the TaskStatus enum
    const ACTIVE_STATUSES: TaskStatus[] = [
      TaskStatus.IN_PROGRESS,
      TaskStatus.READY_TO_TEST,
      TaskStatus.TESTIN_IN_PROGRESS,
      TaskStatus.ON_HOLD,
      TaskStatus.FAILED_TEST,
    ];

    const COMPLETED_STATUSES: TaskStatus[] = [
      TaskStatus.COMPLETED,
      TaskStatus.Dev_COMPLETED,
      TaskStatus.Dev_Setup_Completed,
    ];

    const OPEN_STATUSES: TaskStatus[] = [TaskStatus.NOT_STARTED];

    const activeTasks = tasks.filter((t) => ACTIVE_STATUSES.includes(t.status));
    const completedTasks = tasks.filter((t) =>
      COMPLETED_STATUSES.includes(t.status),
    );
    const openTasks = tasks.filter((t) => OPEN_STATUSES.includes(t.status));

    const total = tasks.length;

    // 4. Compute rates
    const completionRate =
      total > 0 ? Math.round((completedTasks.length / total) * 100) : 0;

    const workloadUtilization =
      total > 0
        ? Math.min(
          Math.round(((activeTasks.length + openTasks.length) / total) * 100),
          100,
        )
        : 0;
    // const workloadUtilization =
    //   total > 0
    //     ? Math.min(Math.round((activeTasks.length / total) * 100), 100)
    //     : 0;

    // 5. Helper: derive a progress % from task status (used when no explicit progress column exists)
    const statusProgressMap: Record<string, number> = {
      [TaskStatus.NOT_STARTED]: 0,
      [TaskStatus.IN_PROGRESS]: 50,
      [TaskStatus.READY_TO_TEST]: 75,
      [TaskStatus.TESTIN_IN_PROGRESS]: 80,
      [TaskStatus.FAILED_TEST]: 35,
      [TaskStatus.ON_HOLD]: 40,
      [TaskStatus.Dev_COMPLETED]: 100,
      [TaskStatus.Dev_Setup_Completed]: 100,
      [TaskStatus.COMPLETED]: 100,
    };

    // 6. Shape the staff profile
    const employment = (staff as any).employment;
    const jobTitle: string = employment?.jobTitle?.length
      ? employment.jobTitle[0]
      : 'Staff';
    const department: string =
      employment?.department?.departmentName ?? 'General';
    const employmentStatus: string = employment?.status ?? 'Active';

    return {
      staff: {
        id: staff.id,
        fullName: `${staff.firstName} ${staff.lastName}`,
        title: jobTitle,
        department,
        status: employmentStatus,
        photoUrl: staff.photoUrl ?? null,
      },
      productivity: {
        completionRate,
        workloadUtilization,
        capacityLabel:
          workloadUtilization >= 85
            ? 'At capacity'
            : workloadUtilization >= 60
              ? 'High'
              : workloadUtilization >= 30
                ? 'Moderate'
                : 'Low',
      },
      currentWork: {
        activeTasks: activeTasks.length,
        openTasks: openTasks.length,
        completedTasks: completedTasks.length,
        totalTasks: total,
      },
      activeTasks: activeTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        urgency: t.urgency,
        progress: statusProgressMap[t.status] ?? 0,
        project: t.project?.projectName ?? 'Personal Task',
        projectId: t.project?.id ?? null,
        department: t.department?.name ?? null,
        departmentId: t.department?.id ?? null,
        dueDate: t.dueDate ?? null,
        startDate: t.startDate ?? null,
        sprint: t.sprint,
      })),
      completedTasks: completedTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        completedDate: t.completed_Date ?? t.updatedAt,
        project: t.project?.projectName ?? 'Personal Task',
        projectId: t.project?.id ?? null,
        department: t.department?.name ?? null,
        departmentId: t.department?.id ?? null,
        startDate: t.startDate ?? null,
        dueDate: t.dueDate ?? null,
      })),
      openTasks: openTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        urgency: t.urgency,
        project: t.project?.projectName ?? 'Personal Task',
        projectId: t.project?.id ?? null,
        department: t.department?.name ?? null,
        departmentId: t.department?.id ?? null,
        startDate: t.startDate ?? null,
        dueDate: t.dueDate ?? null,
        sprint: t.sprint,
      })),
    };
  }

  async getStaffTasksByStatusWithPagination(
    staffId: number,
    activePageNum: number = 1,
    activePageSize: number = 10,
    activeSearch: string = '',
    completedPageNum: number = 1,
    completedPageSize: number = 10,
    completedSearch: string = '',
    openPageNum: number = 1,
    openPageSize: number = 10,
    openSearch: string = '',
  ) {
    // Verify staff exists
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    // Load all task assignments for this staff
    const assignments = await this.assignmentRepo.find({
      where: { staff: { id: staffId } },
      relations: ['task', 'task.project', 'task.department', 'task.createdBy'],
    });

    const tasks = assignments.map((a) => a.task).filter(Boolean);

    // Status grouping
    const ACTIVE_STATUSES: TaskStatus[] = [
      TaskStatus.IN_PROGRESS,
      TaskStatus.READY_TO_TEST,
      TaskStatus.TESTIN_IN_PROGRESS,
      TaskStatus.ON_HOLD,
      TaskStatus.FAILED_TEST,
    ];

    const COMPLETED_STATUSES: TaskStatus[] = [
      TaskStatus.COMPLETED,
      TaskStatus.Dev_COMPLETED,
      TaskStatus.Dev_Setup_Completed,
    ];

    const OPEN_STATUSES: TaskStatus[] = [TaskStatus.NOT_STARTED];

    // Filter by status
    let activeTasks = tasks.filter((t) => ACTIVE_STATUSES.includes(t.status));
    let completedTasks = tasks.filter((t) =>
      COMPLETED_STATUSES.includes(t.status),
    );
    let openTasks = tasks.filter((t) => OPEN_STATUSES.includes(t.status));

    // Helper function to filter by search term
    const filterBySearch = (taskList: Task[], searchTerm: string) => {
      if (!searchTerm.trim()) return taskList;
      const lowerSearch = searchTerm.toLowerCase();
      return taskList.filter(
        (t) =>
          t.title.toLowerCase().includes(lowerSearch) ||
          t.description?.toLowerCase().includes(lowerSearch) ||
          t.project?.projectName.toLowerCase().includes(lowerSearch),
      );
    };

    // Apply search filters
    activeTasks = filterBySearch(activeTasks, activeSearch);
    completedTasks = filterBySearch(completedTasks, completedSearch);
    openTasks = filterBySearch(openTasks, openSearch);

    // Helper function for pagination
    const paginate = (taskList: Task[], pageNum: number, pageSize: number) => {
      const start = (pageNum - 1) * pageSize;
      const end = start + pageSize;
      const items = taskList.slice(start, end);
      const totalCount = taskList.length;
      const totalPages = Math.ceil(totalCount / pageSize);

      return {
        items,
        pagination: {
          currentPage: pageNum,
          pageSize,
          totalCount,
          totalPages,
        },
      };
    };

    // Apply pagination
    const activeData = paginate(activeTasks, activePageNum, activePageSize);
    const completedData = paginate(
      completedTasks,
      completedPageNum,
      completedPageSize,
    );
    const openData = paginate(openTasks, openPageNum, openPageSize);

    // Progress map based on task status
    const statusProgressMap: Record<string, number> = {
      [TaskStatus.NOT_STARTED]: 0,
      [TaskStatus.IN_PROGRESS]: 50,
      [TaskStatus.READY_TO_TEST]: 75,
      [TaskStatus.TESTIN_IN_PROGRESS]: 80,
      [TaskStatus.FAILED_TEST]: 70,
      [TaskStatus.ON_HOLD]: 40,
      [TaskStatus.Dev_COMPLETED]: 100,
      [TaskStatus.Dev_Setup_Completed]: 100,
      [TaskStatus.COMPLETED]: 100,
    };

    // Map tasks to response format with projectId and progress
    const mapTaskToResponse = (t: Task) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      urgency: t.urgency,
      progress: statusProgressMap[t.status] ?? 0,
      project: t.project?.projectName ?? 'Personal Task',
      projectId: t.project?.id ?? null,
      department: t.department?.name ?? null,
      departmentId: t.department?.id ?? null,
      dueDate: t.dueDate ?? null,
      startDate: t.startDate ?? null,
      sprint: t.sprint,
      createdBy: t.createdBy
        ? `${t.createdBy.firstName} ${t.createdBy.lastName}`
        : null,
    });

    return {
      activeTasks: {
        data: activeData.items.map(mapTaskToResponse),
        pagination: activeData.pagination,
      },
      completedTasks: {
        data: completedData.items.map(mapTaskToResponse),
        pagination: completedData.pagination,
      },
      openTasks: {
        data: openData.items.map(mapTaskToResponse),
        pagination: openData.pagination,
      },
      summary: {
        totalActiveTasks: activeData.pagination.totalCount,
        totalCompletedTasks: completedData.pagination.totalCount,
        totalOpenTasks: openData.pagination.totalCount,
        totalTasks:
          activeData.pagination.totalCount +
          completedData.pagination.totalCount +
          openData.pagination.totalCount,
      },
    };
  }

  async getStaffCompletionLevel(staffId: number) {
    // 1. Verify staff exists
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
    });

    if (!staff) throw new NotFoundException('Staff not found');

    // 2. Get all assignments
    const assignments = await this.assignmentRepo.find({
      where: { staff: { id: staffId } },
      relations: ['task', 'task.project', 'task.department', 'task.createdBy'],
    });

    const tasks = assignments.map((a) => a.task).filter(Boolean);

    // 3. Define completed statuses
    const COMPLETED_STATUSES: TaskStatus[] = [
      TaskStatus.COMPLETED,
      TaskStatus.Dev_COMPLETED,
      TaskStatus.Dev_Setup_Completed,
    ];

    const completedTasks = tasks.filter((t) =>
      COMPLETED_STATUSES.includes(t.status),
    );

    const totalTasks = tasks.length;

    // 4. Compute completion rate
    const completionRate =
      totalTasks > 0
        ? Math.round((completedTasks.length / totalTasks) * 100)
        : 0;

    // 5. Determine performance level
    let level = 'RED';
    let colorCode = '#FF2802';
    if (totalTasks === 0) {
      level = 'PINK';
      colorCode = '#FF69B4';
    } else if (completionRate >= 86) {
      level = 'GREEN';
      colorCode = '#00C950';
    } else if (completionRate >= 50) {
      level = 'YELLOW';
      colorCode = '#EDD328';
    }

    return {
      staffId: staff.id,
      staffName: `${staff.firstName} ${staff.lastName}`,
      totalTasks,
      completedTasks: completedTasks.length,
      completionRate,
      performance: {
        level,
        colorCode,
        label:
          level === 'GREEN'
            ? 'Excellent'
            : level === 'YELLOW'
              ? 'Moderate'
              : 'Needs Attention',
      },
    };
  }
}
