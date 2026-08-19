import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectComment } from './entities/project-comment.entity';
import { ProjectAssignment } from './entities/project-assessment.entity';
import {
  Project,
  ProjectStatus,
  ProjectPriority,
} from './entities/project.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ProjectMailService } from './services/mail.service';
import { Department } from 'src/departments/entities/department.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { NotificationType } from 'src/notification/entities/notification.entity';
import { NotificationService } from 'src/notification/notification.service';
import { v4 as uuidv4 } from 'uuid';
import { MemberActivityService } from 'src/member-activity/member-activity.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectAssignment)
    private readonly assignmentRepo: Repository<ProjectAssignment>,
    @InjectRepository(ProjectComment)
    private readonly commentRepo: Repository<ProjectComment>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(ProjectAssignment)
    private readonly projectAssignmentRepo: Repository<ProjectAssignment>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    @InjectRepository(Staff) private readonly staffRepo: Repository<Staff>,
    private readonly mailService: ProjectMailService,
    private readonly notificationService: NotificationService,
    private readonly activityService: MemberActivityService,
  ) { }

  private async getAuthorizedStaff(userId: number): Promise<Staff> {
    // 1. Check if the user is a staff member first (most common case)
    let staff = await this.staffRepo.findOne({
      where: { id: Number(userId) },
      relations: ['roles'],
    });

    let admin: Admin | null = null;

    if (staff) {
      // Check if this staff email belongs to an admin
      admin = await this.adminRepository.findOne({
        where: { email: staff.email },
      });
    } else {
      // 2. If not found by staff ID, check if the ID belongs to an admin
      admin = await this.adminRepository.findOne({
        where: { id: Number(userId) },
        relations: ['staff'],
      });

      if (admin && admin.isAdmin === true) {
        if (admin.staff) {
          staff = await this.staffRepo.findOne({
            where: { id: admin.staff.id },
            relations: ['roles'],
          });
        } else {
          staff = await this.staffRepo.findOne({
            where: { email: admin.email },
            relations: ['roles'],
          });
        }
      }
    }

    // If they are an admin, they are automatically authorized if they have a linked staff record
    if (admin && admin.isAdmin === true) {
      if (!staff) {
        throw new BadRequestException('Linked staff not found for admin');
      }
      return staff;
    }

    // If not an admin, we must have found a staff record
    if (!staff) {
      throw new BadRequestException('User not found');
    }

    // 4. Not an admin, check for authorized roles
    const authorizedRoles = ['Project Manager', 'Departmental Head', 'HR'];
    const hasAuthorizedRole = staff.roles?.some((role) =>
      authorizedRoles.some(
        (authRole) => authRole.toLowerCase() === role.name.toLowerCase(),
      ),
    );

    if (!hasAuthorizedRole) {
      throw new BadRequestException(
        `User ${staff.firstName} ${staff.lastName} with roles [${staff.roles?.map((r) => r.name).join(', ')}] is not authorized for this action. Required roles: ${authorizedRoles.join(', ')}`,
      );
    }

    return staff;
  }

  async create(
    dto: CreateProjectDto,
    userId: number,
    file?: Express.Multer.File,
  ): Promise<Project> {
    const creator = await this.getAuthorizedStaff(userId);
    const exists = await this.projectRepo.findOne({
      where: { projectName: dto.projectName },
    });
    if (exists)
      throw new ConflictException('A project with this name already exists');
    const dept = await this.departmentRepo.findOne({
      where: { id: dto.departmentId },
    });
    if (!dept) throw new NotFoundException('Department not found');
    const project = this.projectRepo.create({
      projectName: dto.projectName,
      desc: dto.desc,
      timeLine: dto.timeLine,
      status: dto.status,
      department: dept,
      priority: dto.priority ?? ProjectPriority.MEDIUM,
      prodUrl: dto.prodUrl,
      stagingUrl: dto.stagingUrl,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      createdBy: creator,
      apk: dto.apk,
    });

    const savedProject = await this.projectRepo.save(project);

    // Log activity
    await this.activityService.logActivity(
      creator.id,
      `Created Project: ${savedProject.projectName}`,
      'Success',
      undefined,
      String(savedProject.id),
    );

    return savedProject;
  }

  async findAll(departmentId?: number): Promise<Project[]> {
    const where: any = {};
    if (departmentId) {
      where.department = { id: departmentId };
    }
    return this.projectRepo.find({
      where,
      relations: [
        'assignedTo',
        'assignedTo.staff',
        'comments',
        'comments.staff',
        'createdBy',
        'department',
      ],
      order: { createdAt: 'DESC' },
    });
  }
  // projects.service.ts
  async getAllWithPagination(
    page = 1,
    limit = 10,
    search?: string,
    status?: string,
    sort?: 'newest' | 'oldest',
  ): Promise<{ data: any[]; page: number; limit: number; total: number }> {
    const query = this.projectRepo
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.assignedTo', 'assignedTo')
      .leftJoinAndSelect('assignedTo.staff', 'staff')
      .leftJoinAndSelect('project.comments', 'comments')
      .leftJoinAndSelect('comments.staff', 'commentStaff')
      .leftJoinAndSelect('project.createdBy', 'createdBy')
      .leftJoinAndSelect('project.department', 'department')
      .leftJoinAndSelect('project.tasks', 'tasks');

    if (search) {
      query.andWhere(
        `(LOWER(project.projectName) LIKE LOWER(:search)
      OR LOWER(CAST(project.status AS text)) LIKE LOWER(:search)
      OR LOWER(department.name) LIKE LOWER(:search))`,
        { search: `%${search}%` },
      );
    }

    if (status) {
      query.andWhere('project.status = :status', { status });
    }

    if (sort === 'oldest') {
      query.orderBy('project.createdAt', 'ASC');
    } else {
      query.orderBy('project.createdAt', 'DESC');
    }

    const [result, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    /**
     * Task status → progress map
     */
    const statusProgressMap: Record<string, number> = {
      Not_started: 0,
      In_progress: 50,
      Ready_To_Test: 75,
      Testing_In_Progress: 80,
      Failed_Test: 25,
      On_Hold: 40,
      Passed_Test: 100,
      Dev_Completed: 100,
      Completed: 100,
    };

    const projectsWithProgress = result.map((project) => {
      const tasks = project.tasks || [];

      const totalTasks = tasks.length;

      let progressSum = 0;

      for (const task of tasks) {
        progressSum += statusProgressMap[task.status] ?? 0;
      }

      const projectProgress =
        totalTasks > 0 ? Math.round(progressSum / totalTasks) : 0;

      /**
       * Derive project status from progress
       */
      let derivedStatus: ProjectStatus;

      if (projectProgress === 0) {
        derivedStatus = ProjectStatus.NOT_STARTED;
      } else if (projectProgress < 75) {
        derivedStatus = ProjectStatus.IN_PROGRESS;
      } else if (projectProgress < 100) {
        derivedStatus = ProjectStatus.TESTING;
      } else {
        derivedStatus = ProjectStatus.COMPLETED;
      }
      return {
        ...project,
        projectProgress,
        derivedStatus,
      };
    });

    return {
      data: projectsWithProgress,
      page,
      limit,
      total,
    };
  }
  async getAllWithPaginationData(
    page = 1,
    limit = 10,
    search?: string,
    status?: string,
    sort?: 'newest' | 'oldest',
  ): Promise<{ data: Project[]; page: number; limit: number; total: number }> {
    const query = this.projectRepo
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.assignedTo', 'assignedTo')
      .leftJoinAndSelect('assignedTo.staff', 'staff')
      .leftJoinAndSelect('project.comments', 'comments')
      .leftJoinAndSelect('comments.staff', 'commentStaff')
      .leftJoinAndSelect('project.createdBy', 'createdBy')
      .leftJoinAndSelect('project.department', 'department');

    // 🔍 Search by name, status, or department
    if (search) {
      query.andWhere(
        `(LOWER(project.projectName) LIKE LOWER(:search)
      OR LOWER(CAST(project.status AS text)) LIKE LOWER(:search)
      OR LOWER(department.name) LIKE LOWER(:search))`,
        { search: `%${search}%` },
      );
    }

    // 🔹 Filter by status
    if (status) {
      query.andWhere('project.status = :status', { status });
    }

    // 🔹 Sort order (default newest)
    if (sort === 'oldest') {
      query.orderBy('project.createdAt', 'ASC');
    } else {
      query.orderBy('project.createdAt', 'DESC');
    }

    const [result, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data: result,
      page,
      limit,
      total,
    };
  }
  async findOne(id: number): Promise<any> {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: [
        'assignedTo',
        'assignedTo.staff',
        'assignedTo.staff.address',
        'assignedTo.staff.employment',
        'comments',
        'department',
        'comments.staff',
        'createdBy',
        'createdBy.address',
        'createdBy.employment',
        'tasks', // IMPORTANT
      ],
    });

    if (!project) throw new NotFoundException('Project not found');

    /**
     * Task status → progress map
     */
    const statusProgressMap: Record<string, number> = {
      Not_started: 0,
      In_progress: 50,
      Ready_To_Test: 75,
      Testing_In_Progress: 80,
      Failed_Test: 25,
      On_Hold: 40,
      Passed_Test: 100,
      Dev_Completed: 100,
      Completed: 100,
    };

    const tasks = project.tasks || [];
    const totalTasks = tasks.length;

    let progressSum = 0;

    for (const task of tasks) {
      progressSum += statusProgressMap[task.status] ?? 0;
    }

    const projectProgress =
      totalTasks > 0 ? Math.round(progressSum / totalTasks) : 0;

    /**
     * Derive project status
     */
    let derivedStatus: ProjectStatus;

    if (projectProgress === 0) {
      derivedStatus = ProjectStatus.NOT_STARTED;
    } else if (projectProgress < 75) {
      derivedStatus = ProjectStatus.IN_PROGRESS;
    } else if (projectProgress < 100) {
      derivedStatus = ProjectStatus.TESTING;
    } else {
      derivedStatus = ProjectStatus.COMPLETED;
    }

    return {
      ...project,
      projectProgress,
      derivedStatus,
    };
  }
  async findOnes(id: number): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: [
        'assignedTo',
        'assignedTo.staff',
        'assignedTo.staff.address',
        'assignedTo.staff.employment',
        'comments',
        'department',
        'comments.staff',
        'createdBy',
        'createdBy.address',
        'createdBy.employment',
      ],
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
  async findByUuid(uuid: string): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { uuid },
      relations: [
        'assignedTo',
        'assignedTo.staff',
        'assignedTo.staff.address',
        'assignedTo.staff.employment',
        'comments',
        'department',
        'comments.staff',
        'createdBy',
        'createdBy.address',
        'createdBy.employment',
      ],
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }
  async remove(id: number): Promise<{ message: string }> {
    const project = await this.projectRepo.findOne({ where: { id } });
    if (!project) throw new NotFoundException('Project not found');
    await this.projectRepo.remove(project);
    return {
      message: 'Delete successful',
    };
  }

  async assignMultipleStaff(
    projectId: number,

    assignments: { staffId: number; role: string }[],
    userId: string,
  ): Promise<ProjectAssignment[]> {
    await this.getAuthorizedStaff(Number(userId));
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const existingAssignments = await this.assignmentRepo.find({
      where: { project: { id: projectId } },
      relations: ['staff'],
    });

    const newStaffIds = assignments.map((a) => a.staffId);
    const toRemove = existingAssignments.filter(
      (ea) => !newStaffIds.includes(ea.staff.id),
    );
    if (toRemove.length > 0) {
      await this.assignmentRepo.remove(toRemove);
    }

    const results: ProjectAssignment[] = [];

    for (const { staffId, role } of assignments) {
      // Guard: skip null/zero/invalid staffId entries instead of crashing//
      const numericStaffId = Number(staffId);
      if (!numericStaffId || !Number.isFinite(numericStaffId) || numericStaffId <= 0) {
        console.warn(`[assignMultipleStaff] Skipping invalid staffId: ${staffId}`);
        continue;
      }
      const staff = await this.staffRepo.findOne({ where: { id: numericStaffId } });
      if (!staff) throw new NotFoundException(`Staff ${numericStaffId} not found`);

      const existing = await this.assignmentRepo.findOne({
        where: { project: { id: projectId }, staff: { id: numericStaffId } },
      });

      if (existing) {
        if (existing.role !== role) {
          existing.role = role;
          results.push(await this.assignmentRepo.save(existing));
        } else {
          results.push(existing);
        }
      } else {
        const assignment = this.assignmentRepo.create({ project, staff, role });
        console.log('Creating assignment:', assignment);
        results.push(await this.assignmentRepo.save(assignment));
      }
      /////push to notification service (fire-and-forget — must not crash assignment on failure)
      const title = `Assigned you to a Project: ${project.projectName}`;
      const message = `You were assigned as ${role} on project ${project.projectName}. Start: ${project.startDate
        ? new Date(project.startDate).toLocaleDateString()
        : 'N/A'
        }  End: ${project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A'}`;

      try {
        await this.notificationService.createNotificationForStaff(
          staff,
          NotificationType.ASSIGNMENT,
          title,
          message,
          project,
        );
      } catch (notifErr) {
        console.warn(`[assignMultipleStaff] Notification failed for staff ${staffId}:`, notifErr?.message);
      }

      // push to mail service (fire-and-forget — must not crash assignment on failure)
      try {
        await this.mailService.sendAssignmentMail(staff, project, role);
      } catch (mailErr) {
        console.warn(`[assignMultipleStaff] Email failed for staff ${staffId} (${staff.email}):`, mailErr?.message);
      }
    }

    return results;
  }
  async updateProject(
    projectId: number,
    dto: UpdateProjectDto,

    userId: string,
    file?: Express.Multer.File,
  ): Promise<Project> {
    // --- 1. Authorization check ---
    await this.getAuthorizedStaff(Number(userId));

    // --- 2. Find existing project ---
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['assignedTo', 'assignedTo.staff'],
    });
    if (!project) throw new NotFoundException('Project not found');

    // --- 3. Handle APK upload (if provided) ---
    if (file) {
      const s3File = file as Express.Multer.File & { location: string };
      if (s3File.location) dto.apk = s3File.location;
      else throw new BadRequestException('File upload to S3 failed');
    }

    // --- 4. Detect project field changes ---
    const fieldKeys = [
      'projectName',
      'desc',
      'timeLine',
      'status',
      'priority',
      'prodUrl',
      'stagingUrl',
      'apk',
      'startDate',
      'endDate',
    ];
    const hasFieldChanges = fieldKeys.some((key) => dto.hasOwnProperty(key));

    // --- 5. Detect actual assignment changes ---
    let assignmentsUpdated = false;
    let newAssignedStaffs: Staff[] = [];

    const newAssignments = dto.assignments ?? []; // ✅ Ensure always an array

    if (dto.assignments !== undefined) {
      const oldAssignments = project.assignedTo.map((a) => ({
        staffId: a.staff.id,
        role: a.role,
      }));

      // Compare by staffId + role//
      const isSame =
        oldAssignments.length === newAssignments.length &&
        oldAssignments.every((oldA) =>
          newAssignments.some(
            (newA) => newA.staffId === oldA.staffId && newA.role === oldA.role,
          ),
        );

      if (!isSame) {
        assignmentsUpdated = true;
        const updatedAssignments = await this.assignMultipleStaff(
          projectId,
          newAssignments,
          userId,
        );
        project.assignedTo = updatedAssignments;
        newAssignedStaffs = updatedAssignments.map((a) => a.staff);
      }
    }

    // --- 6. Apply field updates ---
    if (dto.projectName) project.projectName = dto.projectName;
    if (dto.desc !== undefined) project.desc = dto.desc;
    if (dto.timeLine !== undefined) project.timeLine = dto.timeLine;
    if (dto.status !== undefined) project.status = dto.status;
    if (dto.priority !== undefined) project.priority = dto.priority;
    if (dto.prodUrl !== undefined) project.prodUrl = dto.prodUrl;
    if (dto.stagingUrl !== undefined) project.stagingUrl = dto.stagingUrl;
    if (dto.apk !== undefined) project.apk = dto.apk;
    if (dto.startDate !== undefined)
      project.startDate =
        dto.startDate && !isNaN(Date.parse(dto.startDate))
          ? new Date(dto.startDate)
          : null;
    if (dto.endDate !== undefined)
      project.endDate =
        dto.endDate && !isNaN(Date.parse(dto.endDate))
          ? new Date(dto.endDate)
          : null;

    // --- 7. Save project ---
    const updatedProject = await this.projectRepo.save(project);

    // --- 8. Notify affected staff ---
    const assignedStaffs = (project.assignedTo || [])
      .map((a) => a.staff)
      .filter(Boolean);

    if (assignmentsUpdated && newAssignedStaffs.length > 0) {
      // 🔹 New staff assignments detected //
      const title = `New Project Assignment: ${updatedProject.projectName}`;
      const message = `You have been assigned to a new project: ${updatedProject.projectName}.`;

      await this.notificationService.createNotificationsForStaffs(
        newAssignedStaffs,
        NotificationType.ASSIGNMENT,
        title,
        message,
        updatedProject,
      );

      for (const staff of newAssignedStaffs) {
        await this.mailService.sendUpdateMail(staff, updatedProject);
      }
    } else if (hasFieldChanges) {
      // 🔹 Only project details updated
      const title = `Project Updated: ${updatedProject.projectName}`;
      const message = `Project "${updatedProject.projectName}" has been updated. Current Status: ${updatedProject.status}.`;

      await this.notificationService.createNotificationsForStaffs(
        assignedStaffs,
        NotificationType.PROJECT_UPDATE,
        title,
        message,
        updatedProject,
      );

      for (const assignment of project.assignedTo) {
        await this.mailService.sendUpdateMail(assignment.staff, updatedProject);
      }
    }

    // Log activity
    await this.activityService.logActivity(
      Number(userId),
      `Updated Project: ${updatedProject.projectName} (Status: ${updatedProject.status})`,
      'Success',
      undefined,
      String(updatedProject.id),
    );

    return updatedProject;
  }

  async updateProjectOld(
    projectId: number,

    dto: UpdateProjectDto,
    userId: string,
    file?: Express.Multer.File,
  ): Promise<Project> {
    const admin = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });

    if (!admin || admin.isAdmin !== true) {
      // 🔹 If not admin, check if Hiring Manager
      const staff = await this.staffRepo.findOne({
        where: { id: Number(userId) },
        relations: ['roles'],
      });

      if (
        !staff ||
        !staff.roles.some((role) => role.name === 'Project Manager')
      ) {
        throw new BadRequestException(
          'Only Project Managers or Admins can update a project',
        );
      }
    }
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['assignedTo', 'assignedTo.staff'], // so we can update assignments
    });
    if (!project) throw new NotFoundException('Project not found');
    if (file) {
      const s3File = file as Express.Multer.File & { location: string };
      if (s3File.location) {
        dto.apk = s3File.location;
      } else {
        throw new BadRequestException(
          'File upload to S3 failed: location missing',
        );
      }
    }
    // Update basic project fields
    Object.assign(project, {
      projectName: dto.projectName ?? project.projectName,
      desc: dto.desc ?? project.desc,
      timeLine: dto.timeLine ?? project.timeLine,
      status: dto.status ?? project.status,
      priority: dto.priority ?? project.priority,
      prodUrl: dto.prodUrl ?? project.prodUrl,
      stagingUrl: dto.stagingUrl ?? project.stagingUrl,
      apk: dto.apk ?? project.apk,
      startDate: dto.startDate ? new Date(dto.startDate) : project.startDate,
      endDate: dto.endDate ? new Date(dto.endDate) : project.endDate,
    });

    // ✅ Handle staff assignments if provided
    if (dto.assignments && dto.assignments.length > 0) {
      const updatedAssignments = await this.assignMultipleStaff(
        projectId,

        dto.assignments,
        userId,
      );
      project.assignedTo = updatedAssignments;
    }
    const updatedProject = await this.projectRepo.save(project);

    // Notify all assigned staff (automated) - use assignedTo list
    const assignedStaffs = (project.assignedTo || [])
      .map((a) => a.staff)
      .filter(Boolean);

    if (assignedStaffs.length > 0) {
      const title = `Project updated: ${updatedProject.projectName}`;
      const message = `Project ${updatedProject.projectName} has been updated. Status: ${updatedProject.status}.`;
      await this.notificationService.createNotificationsForStaffs(
        assignedStaffs,
        NotificationType.PROJECT_UPDATE,
        title,
        message,
        updatedProject,
      );
    }
    // Notify all assigned staff
    for (const assignment of project.assignedTo) {
      await this.mailService.sendUpdateMail(assignment.staff, updatedProject);
    }

    return updatedProject;
  }

  async addComment(
    projectId: number,
    staffId: number,
    text: string,
  ): Promise<ProjectComment> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });
    if (!project) throw new NotFoundException('Project not found');

    const staff = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff not found');

    const isAssigned = await this.projectAssignmentRepo.findOne({
      where: {
        project: { id: project.id },
        staff: { id: staffId },
      },
    });

    if (!isAssigned) {
      throw new ForbiddenException(
        'You are not assigned to this project and cannot comment.',
      );
    }

    const comment = this.commentRepo.create({ project, staff, text });
    // Notify assigned staff (exclude the commenter)
    const assigned = await this.projectAssignmentRepo.find({
      where: { project: { id: project.id } },
      relations: ['staff'],
    });

    const recipients = assigned
      .map((a) => a.staff)
      .filter((s) => s && s.id !== staffId);

    if (recipients.length > 0) {
      const title = `New comment on: ${project.projectName}`;
      const message = `${staff.firstName ?? 'A member'} added a comment on project ${project.projectName}: "${text.slice(0, 120)}"`;
      await this.notificationService.createNotificationsForStaffs(
        recipients,
        NotificationType.COMMENT,
        title,
        message,
        project,
      );
    }
    return this.commentRepo.save(comment);
  }

  async getUserProjects(
    userId: number,
    scope: 'created' | 'assigned' | 'all' = 'all',
  ): Promise<Project[]> {
    if (scope === 'created') {
      return this.projectRepo.find({
        where: { createdBy: { id: userId } },
        relations: [
          'assignedTo',
          'assignedTo.staff',
          'comments',
          'department',
          'comments.staff',
          'createdBy',
        ],
        order: { createdAt: 'DESC' },
      });
    }

    if (scope === 'assigned') {
      const qb = this.projectRepo
        .createQueryBuilder('p')
        .leftJoinAndSelect('p.createdBy', 'createdBy')
        .leftJoinAndSelect('p.assignedTo', 'assignedTo')
        .leftJoinAndSelect('assignedTo.staff', 'assignedStaff')
        .leftJoinAndSelect('p.comments', 'comments')
        .leftJoinAndSelect('comments.staff', 'commentStaff')
        .where('assignedStaff.id = :userId', { userId })
        .orderBy('p.createdAt', 'DESC');
      return qb.getMany();
    }

    // scope = 'all' -> union of created and assigned (distinct)
    const [created, assigned] = await Promise.all([
      this.getUserProjects(userId, 'created'),
      this.getUserProjects(userId, 'assigned'),
    ]);
    const map = new Map<number, Project>();
    [...created, ...assigned].forEach((p) => map.set(p.id, p));
    return Array.from(map.values()).sort(
      (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
    );
  }

  // Get all projects assigned to a specific staff//
  async getAllProjectsAssignedToStaff(staffId: number): Promise<Project[]> {
    const projects = await this.projectRepo.find({
      relations: [
        'assignedTo',
        'assignedTo.staff',
        'createdBy',
        'comments',
        'department',
      ],
      where: {
        assignedTo: {
          staff: { id: staffId },
        },
      },
    });

    if (!projects.length) {
      throw new NotFoundException(
        `No projects found for staff with ID ${staffId}`,
      );
    }

    return projects;
  }
  async getProjectStats() {
    const projects = await this.projectRepo.find({
      relations: ['tasks'],
    });

    const statusProgressMap: Record<string, number> = {
      Not_started: 0,
      In_progress: 50,
      Ready_To_Test: 75,
      Testing_In_Progress: 80,
      Failed_Test: 25,
      On_Hold: 40,
      Passed_Test: 100,
      Dev_Completed: 100,
      Completed: 100,
    };

    let total = projects.length;
    let active = 0;
    let completed = 0;
    let planning = 0;

    for (const project of projects) {
      const tasks = project.tasks || [];
      const totalTasks = tasks.length;
      let progressSum = 0;

      for (const task of tasks) {
        progressSum += statusProgressMap[task.status] ?? 0;
      }

      const projectProgress =
        totalTasks > 0 ? Math.round(progressSum / totalTasks) : 0;

      if (projectProgress === 0) {
        planning++;
      } else if (projectProgress < 100) {
        active++;
      } else {
        completed++;
      }
    }

    return {
      total,
      active,
      completed,
      planning,
    };
  }

  async getProjectIdAssignedStaffs(projectId: number) {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const assignments = await this.assignmentRepo.find({
      where: { project: { id: projectId } },
      relations: ['staff'], // eager staff included, but keeping for safety
    });

    return assignments.map((assignment) => ({
      staff: assignment.staff,
      role: assignment.role,
    }));
  }
}
