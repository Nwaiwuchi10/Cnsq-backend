import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  CreateStaffRegisterDto,
  StaffRegisterDto,
} from './dto/create-staff-register.dto';
import { UpdateStaffRegisterDto } from './dto/update-staff-register.dto';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Staff } from './entities/staff-register.entity';
import { StaffAddress } from './entities/staf-adress.entity';
import { StaffEmployment } from './entities/staff-employment.entity';
import { Department } from 'src/departments/entities/department.entity';
import { DepartmentalRole } from 'src/departmental-role/entities/departmental-role.entity';
import { MailService } from './service/mail.service';
import * as dayjs from 'dayjs';
import { StaffBirthdayDto } from './dto/staffs-birthday.dto';
import {
  StaffAnniversaryDto,
  StaffRecentAnniversaryDto,
} from './dto/staff-anniversary.dto';
import { StaffEmployeeLoginDto, StaffLoginDto } from './dto/login.dto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { AssignRoleDto } from './dto/assign-roles.dto';
import { Role } from 'src/roles/entities/role.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateStaffDto } from './dto/Update-staff-profile.dto';
import * as moment from 'moment-timezone';
import { PaginatedResult } from './dto/paginated-data.dto';
import { v4 as uuidv4 } from 'uuid';
import { TaskStatus } from 'src/task/entities/task.entity';
import { TaskAssignment } from 'src/task/entities/task-asessment.entity';
import { Project } from 'src/projects/entities/project.entity';
import { MemberActivityService } from 'src/member-activity/member-activity.service';
import { Request } from 'express';
// import * as crypto from 'crypto';
@Injectable()
export class StaffRegisterService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Staff) private staffRepo: Repository<Staff>,
    @InjectRepository(StaffAddress) private addrRepo: Repository<StaffAddress>,
    @InjectRepository(Role)
    private rolesPermissionRepo: Repository<Role>,
    @InjectRepository(Department)
    private departmentRepo: Repository<Department>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
    @InjectRepository(DepartmentalRole)
    private roleRepo: Repository<DepartmentalRole>,

    @InjectRepository(TaskAssignment)
    private assignmentRepo: Repository<TaskAssignment>,
    private readonly mailService: MailService,

    @InjectRepository(StaffEmployment)
    private employmentRepo: Repository<StaffEmployment>,
    @InjectRepository(Project)
    private projectRepo: Repository<Project>,
    private jwtService: JwtService,
    private readonly activityService: MemberActivityService,
  ) { }
  async create(
    dto: StaffRegisterDto,
    userId: string,
    file?: Express.Multer.File,
  ) {
    return this.dataSource.transaction(async (manager) => {
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
          !staff.roles.some((role) => role.name === 'Hiring Manager')
        ) {
          throw new BadRequestException(
            'Only Hiring Managers or Admins can create staff',
          );
        }
      }
      const staffExist = await manager.findOne(Staff, {
        where: { email: dto.email },
      });
      if (staffExist) {
        throw new BadRequestException('Email already in use');
      }
      const phoneNumberExist = await manager.findOne(Staff, {
        where: { phone: dto.phone },
      });
      if (phoneNumberExist) {
        throw new BadRequestException('Phone Number already in use');
      }
      // === Find Department & Role ===
      const dept = await this.departmentRepo.findOne({
        where: { id: dto.employment.departmentId },
      });
      if (!dept) throw new NotFoundException('Department not found');

      const role = await this.roleRepo.findOne({
        where: { id: dto.employment.departmentalRoleId },
      });
      if (!role) throw new NotFoundException('DepartmentalRole not found');

      // === Handle S3 file upload ===
      if (file) {
        const s3File = file as Express.Multer.File & { location: string };
        if (s3File.location) {
          dto.photoUrl = s3File.location;
        } else {
          throw new BadRequestException(
            'File upload to S3 failed: location missing',
          );
        }
      }

      // === Generate Unique Employee Code ===
      const lastEmployment = await manager.findOne(StaffEmployment, {
        where: {},
        order: { id: 'DESC' },
      });

      const nextId = lastEmployment ? lastEmployment.id + 1 : 1;

      // take first letter of firstName and lastName (uppercase)
      const initials =
        `${dto.firstName.charAt(0)}${dto.lastName.charAt(0)}`.toUpperCase();

      const employeeCode = `CN-${initials}-${String(nextId).padStart(6, '0')}`;
      // === Create Address ===
      const addr = manager.create(StaffAddress, { ...dto.address });

      // === Create Employment ===
      const emp = manager.create(StaffEmployment, {
        ...dto.employment,
        employeeCode, // auto-generated here
        department: dept,
        departmentalRole: role,
      });

      // === Generate Random Password & 15-min Registration Token ===
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(tempPassword, salt);

      const regToken = uuidv4();
      const regExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes OTP

      // === Create Staff ===
      const staff = manager.create(Staff, {
        ...dto,
        password: hashedPassword,
        registrationToken: regToken,
        registrationTokenExpires: regExpires,
        isRegistered: false,
        address: addr,
        employment: emp,
      });

      const saved = await manager.save(Staff, staff);

      // ✅ Send registration mail with temp password and registration token link
      await this.mailService.sendRegistrationEmail(saved, tempPassword, regToken);

      return saved;
    });
  }

  async creates(dto: StaffRegisterDto, file?: Express.Multer.File) {
    return this.dataSource.transaction(async (manager) => {
      // Find department + role
      const dept = await this.departmentRepo.findOne({
        where: { id: dto.employment.departmentId },
      });
      if (!dept) throw new NotFoundException('Department not found');

      const role = await this.roleRepo.findOne({
        where: { id: dto.employment.departmentalRoleId },
      });
      if (!role) throw new NotFoundException('DepartmentalRole not found');
      if (file) {
        const s3File = file as Express.Multer.File & { location: string };
        if (s3File.location) {
          dto.photoUrl = s3File.location;
        } else {
          throw new BadRequestException(
            'File upload to S3 failed: location missing',
          );
        }
      }
      // Create Address
      const addr = manager.create(StaffAddress, { ...dto.address });

      // Create Employment
      const emp = manager.create(StaffEmployment, {
        ...dto.employment,
        department: dept,
        departmentalRole: role,
      });

      // Create Staff
      const staff = manager.create(Staff, {
        ...dto,
        address: addr,
        employment: emp,
      });

      // return await manager.save(Staff, staff);
      const saved = await manager.save(Staff, staff);

      // ✅ Send onboarding mail
      await this.mailService.staffOnboardingMail(saved);

      return saved;
    });
  }
  async loginStaff(loginDto: StaffLoginDto, req?: Request) {
    const { identifier, password } = loginDto;

    const staff = await this.staffRepo.findOne({
      where: [
        { employment: { employeeCode: identifier } },
        { email: identifier },
      ],
      relations: ['employment'],
      withDeleted: true, // 👈 include soft-deleted users
    });

    if (!staff) {
      throw new NotFoundException('Invalid employee code or email');
    }

    //  BLOCK soft-deleted users
    if (staff.deletedAt) {
      throw new ForbiddenException(
        'Your account has been deactivated. Please contact HR or admin.',
      );
    }

    const isMatch = await bcrypt.compare(password, staff.password);
    if (!isMatch) {
      // Log failed login attempt
      await this.activityService.logActivity(
        staff.id,
        'Login attempt failed',
        'Failed',
        req,
      );
      throw new UnauthorizedException('Invalid password');
    }

    this.mailService.staffLoginMail(staff).catch((err) => {
      console.error('Failed to send login alert email:', err);
    });
    const token = await this.generateJWT(staff);

    // Capture IP
    const ip =
      (req?.headers['x-forwarded-for'] as string) ||
      req?.socket.remoteAddress ||
      'Unknown';

    // Update last IP
    staff.lastIpAddress = ip;
    await this.staffRepo.save(staff);

    // Log successful login
    await this.activityService.logActivity(staff.id, 'Staff Logged In', 'Success', req);

    return {
      id: staff.id,
      email: staff.email,
      firstName: staff.firstName,
      lastName: staff.lastName,
      employeeCode: staff.employment.employeeCode,
      currentStatus: staff.isOnline ? 'Online' : 'Offline',
      isOnline: staff.isOnline,
      token,
    };
  }

  async logoutStaff(userId: number, req?: Request) {
    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }
    const staff = await this.staffRepo.findOne({ where: { id: userId } });
    if (staff) {
      await this.activityService.logActivity(
        staff.id,
        'Staff Logged Out',
        'Success',
        req,
      );
    }
    return { message: 'Logged out successfully' };
  }

  async loginStaffs(loginDto: StaffLoginDto) {
    const { identifier, password } = loginDto;

    // Check staff by employeeCode OR email
    const staff = await this.staffRepo.findOne({
      where: [
        { employment: { employeeCode: identifier } },
        { email: identifier },
      ],
      relations: ['employment'],
    });

    if (!staff) {
      throw new NotFoundException('Invalid employee code or email');
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, staff.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid password');
    }

    // Generate token
    await this.mailService.staffLoginMail(staff);
    const token = await this.generateJWT(staff);

    return {
      id: staff.id,
      email: staff.email,
      firstName: staff.firstName,
      lastName: staff.lastName,
      employeeCode: staff.employment.employeeCode,
      currentStatus: staff.isOnline ? 'Online' : 'Offline',
      isOnline: staff.isOnline,
      token,
    };
  }

  async loginStaffOnlyemployee(loginDto: StaffEmployeeLoginDto) {
    const { employeeCode, password } = loginDto;
    const staff = await this.staffRepo.findOne({
      where: { employment: { employeeCode } },
      relations: ['employment'],
    });
    if (!staff) throw new NotFoundException('Invalid employee Code ');

    const isMatch = await bcrypt.compare(password, staff.password);
    if (!isMatch) throw new UnauthorizedException('Invalid password');

    const token = await this.generateJWT(staff);
    return {
      id: staff.id,
      email: staff.email,
      firstName: staff.firstName,
      lastName: staff.lastName,
      currentStatus: staff.isOnline ? 'Online' : 'Offline',
      isOnline: staff.isOnline,
      token,
    };
  }

  async generateJWT(staff: Staff) {
    const payload = {
      staffId: staff.id,
      email: staff.email,
    };
    return this.jwtService.sign(payload, { expiresIn: '365d' });
  }

  async assignRoles(
    staffId: number,
    dto: AssignRoleDto,
    userId: string,
  ): Promise<Staff> {
    const adminCreateRole: any = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!adminCreateRole || adminCreateRole.isAdmin !== true)
      throw new NotFoundException('Only Admins are Authorized to peform task');

    const staff = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff not found');

    const roles = await this.rolesPermissionRepo.find({
      where: { id: In(dto.roleIds) },
    });
    if (!roles.length) throw new NotFoundException('Roles not found');

    staff.roles = roles;
    return this.staffRepo.save(staff);
  }

  async removeRole(
    staffId: number,
    roleId: number,
    userId: string,
  ): Promise<{ message: string }> {
    // check admin
    const admin = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!admin || admin.isAdmin !== true) {
      throw new NotFoundException(
        'Only Admins are authorized to perform this task',
      );
    }

    // check staff exists
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
      relations: ['roles'],
    });
    if (!staff) throw new NotFoundException('Staff not found');

    // check role exists
    const role = await this.rolesPermissionRepo.findOne({
      where: { id: roleId },
    });
    if (!role) throw new NotFoundException('Role not found');

    // remove role from staff
    staff.roles = staff.roles.filter((r) => r.id !== roleId);

    await this.staffRepo.save(staff);

    return {
      message: `Role with id ${roleId} has been removed from staff ${staffId}`,
    };
  }

  async removeProjectManagerRole(
    staffId: number,
    userId: string,
  ): Promise<{ message: string }> {
    // check admin
    const admin = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!admin || admin.isAdmin !== true) {
      throw new NotFoundException(
        'Only Admins are authorized to perform this task',
      );
    }

    // check staff exists
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
      relations: ['roles'],
    });
    if (!staff) throw new NotFoundException('Staff not found');

    // check role exists
    const role = await this.rolesPermissionRepo.findOne({
      where: { name: 'Project Manager' },
    });
    if (!role) throw new NotFoundException('Project Manager role not found');

    // remove role from staff
    staff.roles = staff.roles.filter((r) => r.name !== 'Project Manager');

    await this.staffRepo.save(staff);

    return {
      message: `Project Manager role has been removed from staff ${staffId}`,
    };
  }

  async removeHrRole(
    staffId: number,
    userId: string,
  ): Promise<{ message: string }> {
    // check admin
    const admin = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!admin || admin.isAdmin !== true) {
      throw new NotFoundException(
        'Only Admins are authorized to perform this task',
      );
    }

    // check staff exists
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
      relations: ['roles'],
    });
    if (!staff) throw new NotFoundException('Staff not found');

    // check role exists
    const role = await this.rolesPermissionRepo.findOne({
      where: { name: 'HR' },
    });
    if (!role) throw new NotFoundException('HR role not found');

    // remove role from staff
    staff.roles = staff.roles.filter((r) => r.name !== 'HR');

    await this.staffRepo.save(staff);

    return {
      message: `HR role has been removed from staff ${staffId}`,
    };
  }


  async findAll(): Promise<Staff[]> {
    return await this.staffRepo.find({
      order: {
        firstName: 'ASC',
        lastName: 'ASC',
      },
    });
  }
  async findOne(id: number): Promise<Staff> {
    const staff = await this.staffRepo.findOne({
      where: { id },
    });
    if (!staff) throw new NotFoundException(`Staff with ID ${id} not found`);
    return { ...staff, currentStatus: staff.isOnline ? 'Online' : 'Offline' } as unknown as Staff;
  }

  async findStaffByuuid(uuid: string): Promise<Staff> {
    const staff = await this.staffRepo.findOne({
      where: { uuid },
    });
    if (!staff) throw new NotFoundException(`Staff with ID ${uuid} not found`);
    return { ...staff, currentStatus: staff.isOnline ? 'Online' : 'Offline' } as unknown as Staff;
  }
  async FindStaff(userId: string): Promise<Staff> {
    const staff = await this.staffRepo.findOne({
      where: { id: Number(userId) },
      relations: ['employment'],
    });
    if (!staff)
      throw new NotFoundException(`Staff with ID ${Number(userId)} not found`);
    return { ...staff, currentStatus: staff.isOnline ? 'Online' : 'Offline' } as unknown as Staff;
  }
  async updateProfile(
    staffId: number,
    dto: UpdateStaffDto,
    file?: Express.Multer.File,
    req?: Request,
  ) {
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
      relations: [
        'address',
        'employment',
        'employment.department',
        'employment.departmentalRole',
      ],
    });

    if (!staff) throw new NotFoundException('Staff not found');

    // handle file upload first
    if (file) {
      const s3File = file as Express.Multer.File & { location: string };
      if (!s3File.location) {
        throw new BadRequestException(
          'File upload to S3 failed: location missing',
        );
      }
      dto.photoUrl = s3File.location;
    }

    // helper: treat null / undefined / empty-string as "not provided"
    const val = <T>(incoming: T | null | undefined, fallback: T): T =>
      incoming !== null && incoming !== undefined && (incoming as unknown as string) !== ''
        ? incoming
        : fallback;

    // basic fields
    Object.assign(staff, {
      firstName: val(dto.firstName, staff.firstName),
      lastName: val(dto.lastName, staff.lastName),
      photoUrl: val(dto.photoUrl, staff.photoUrl),
      description: val(dto.description, staff.description),
      hobbies: dto.hobbies && dto.hobbies.length > 0 ? dto.hobbies : staff.hobbies,
      dateOfBirth: val(dto.dateOfBirth, staff.dateOfBirth),
      gender: val(dto.gender, staff.gender),
      maritalStatus: val(dto.maritalStatus, staff.maritalStatus),
      email: val(dto.email, staff.email),
      phone: val(dto.phone, staff.phone),
    });

    // update address
    if (dto.address) {
      staff.address = { ...staff.address, ...dto.address };
    }

    // update employment
    if (dto.employment) {
      const employment = dto.employment;

      if (employment.departmentId) {
        const dept = await this.departmentRepo.findOneBy({
          id: employment.departmentId,
        });
        if (!dept) throw new NotFoundException('Department not found');
        staff.employment.department = dept;
      }

      if (employment.departmentalRoleId) {
        const role = await this.roleRepo.findOneBy({
          id: employment.departmentalRoleId,
        });
        if (!role) throw new NotFoundException('DepartmentalRole not found');
        staff.employment.departmentalRole = role;
      }

      Object.assign(staff.employment, employment);
    }

    const saved = await this.staffRepo.save(staff);
    // Log profile update
    await this.activityService.logActivity(
      staffId,
      'Staff Update Profile',
      'Success',
      req,
    );
    return saved;
  }

  // ✅ 2) Change Password
  async changePassword(staffId: number, dto: ChangePasswordDto, req?: Request) {
    const staff = await this.staffRepo.findOne({ where: { id: staffId } });
    if (!staff) throw new NotFoundException('Staff not found');

    const isMatch = await bcrypt.compare(dto.oldPassword, staff.password);
    if (!isMatch) throw new UnauthorizedException('Old password is incorrect');

    if (dto.newPassword !== dto.confirmNewPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    const salt = await bcrypt.genSalt(10);
    staff.password = await bcrypt.hash(dto.newPassword, salt);

    const saved = await this.staffRepo.save(staff);
    // Log password change
    await this.activityService.logActivity(
      staffId,
      'Staff Change Password',
      'Success',
      req,
    );
    return saved;
  }

  async updateOnlineStatus(staffId: number, isOnline: boolean) {
    await this.staffRepo.update(staffId, { isOnline });
  }

  async remove(id: number): Promise<any> {
    await this.findOne(id);
    await this.staffRepo.delete(id);
    return {
      message: 'Delete successful',
    };
  }

  // 1) Pagination and the main fetchstaff directory endpoint
  async getAllStaffswithDepartmentswithTaskcompletion(
    page: number,
    limit: number,
    search?: string,
    department?: string,
    role?: string,
    location?: string,
    completionRange?: string, // '0-25' | '26-50' | '51-75' | '76-100'
    projectId?: number,
  ) {
    const query = this.staffRepo
      .createQueryBuilder('staff')
      .leftJoinAndSelect('staff.employment', 'employment')
      .leftJoinAndSelect('employment.department', 'department')
      .leftJoinAndSelect('employment.departmentalRole', 'departmentalRole')
      .leftJoinAndSelect('staff.address', 'address')
      .orderBy('staff.firstName', 'ASC')
      .addOrderBy('staff.lastName', 'ASC')
      .addOrderBy('department.name', 'ASC');

    // ── Search filter (broad, across multiple fields) ─────────────────────────
    if (search) {
      query.andWhere(
        `(LOWER(staff.firstName) LIKE :search
        OR LOWER(staff.lastName) LIKE :search
        OR LOWER(department.name) LIKE :search
        OR LOWER(departmentalRole.title) LIKE :search
        OR LOWER(address.city) LIKE :search
        OR LOWER(address.state) LIKE :search
        OR LOWER(ARRAY_TO_STRING(employment.jobTitle, ' ')) LIKE :search)`,
        { search: `%${search.toLowerCase()}%` },
      );
    }

    // ── Department filter ─────────────────────────────────────────────────────
    if (department) {
      query.andWhere('LOWER(department.name) LIKE :department', {
        department: `%${department.toLowerCase()}%`,
      });
    }

    // ── Role filter ───────────────────────────────────────────────────────────
    if (role) {
      query.andWhere('LOWER(departmentalRole.title) LIKE :role', {
        role: `%${role.toLowerCase()}%`,
      });
    }

    // ── Location filter (city OR state) ───────────────────────────────────────
    if (location) {
      query.andWhere(
        '(LOWER(address.city) LIKE :location OR LOWER(address.state) LIKE :location)',
        { location: `%${location.toLowerCase()}%` },
      );
    }

    // ── If a completion range filter is set, we must fetch ALL (no DB paging)
    //    so we can compute rates first, filter, then paginate in memory.
    const needsPostFilter = !!completionRange && completionRange !== 'all';

    if (!needsPostFilter) {
      query.skip((page - 1) * limit).take(limit);
    }

    const [staffs, dbTotal] = await query.getManyAndCount();

    // ── Task-completion enrichment ────────────────────────────────────────────
    const staffIds = staffs.map((s) => s.id);

    const assignments =
      staffIds.length > 0
        ? await this.assignmentRepo.find({
          where: {
            staff: { id: In(staffIds) },
            ...(projectId ? { task: { project: { id: projectId } } } : {}),
          },
          relations: ['task', 'task.project'],
        })
        : [];

    const COMPLETED_STATUSES: TaskStatus[] = [
      TaskStatus.COMPLETED,
      TaskStatus.Dev_COMPLETED,
      TaskStatus.Dev_Setup_Completed,
    ];

    const staffMap = new Map<number, { totalTasks: number; completedTasks: number }>();
    staffIds.forEach((id) => staffMap.set(id, { totalTasks: 0, completedTasks: 0 }));

    assignments.forEach((assignment) => {
      const staffId = assignment.staff?.id;
      const task = assignment.task;
      if (!staffId || !task) return;
      const record = staffMap.get(staffId);
      if (!record) return;
      record.totalTasks += 1;
      if (COMPLETED_STATUSES.includes(task.status)) {
        record.completedTasks += 1;
      }
    });

    // ── Build enriched list ───────────────────────────────────────────────────
    const enrichedStaffs = staffs.map((staff) => {
      const stats = staffMap.get(staff.id) || { totalTasks: 0, completedTasks: 0 };

      const completionRate =
        stats.totalTasks > 0
          ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
          : 0;

      let level = 'RED';
      let colorCode = '#FF2802';

      if (stats.totalTasks === 0) {
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
        ...staff,
        currentStatus: staff.isOnline ? 'Online' : 'Offline',
        taskPerformance: {
          totalTasks: stats.totalTasks,
          completedTasks: stats.completedTasks,
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
        },
      };
    });

    // ── Task completion range post-filter + in-memory pagination  ──────────────
    let finalData = enrichedStaffs;
    let total = dbTotal;

    if (needsPostFilter) {
      const rangeMap: Record<string, [number, number]> = {
        '0-25': [0, 25],
        '26-50': [26, 50],
        '51-75': [51, 75],
        '76-100': [76, 100],
      };
      const range = rangeMap[completionRange];

      if (range) {
        const [min, max] = range;
        const filtered = enrichedStaffs.filter(
          (s) =>
            s.taskPerformance.completionRate >= min &&
            s.taskPerformance.completionRate <= max,
        );
        total = filtered.length;
        const start = (page - 1) * limit;
        finalData = filtered.slice(start, start + limit);
      }
    }

    return {
      data: finalData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
  // ─── New-Hire endpoint ──────────────────────────────────────────────────────
  async getNewHireStaffs(
    page: number,
    limit: number,
    days = 90,
    search?: string,
  ) {
    // Calculate the cutoff date
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0]; // 'YYYY-MM-DD'

    const query = this.staffRepo
      .createQueryBuilder('staff')
      .leftJoinAndSelect('staff.employment', 'employment')
      .leftJoinAndSelect('employment.department', 'department')
      .leftJoinAndSelect('employment.departmentalRole', 'departmentalRole')
      .leftJoinAndSelect('staff.address', 'address')
      // Only staff whose hireDate is within the last `days` days
      .where('employment.hireDate >= :cutoff', { cutoff: cutoffStr })
      .orderBy('employment.hireDate', 'DESC')
      .addOrderBy('staff.firstName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      query.andWhere(
        `(LOWER(staff.firstName) LIKE :search
        OR LOWER(staff.lastName) LIKE :search
        OR LOWER(department.name) LIKE :search
        OR LOWER(departmentalRole.title) LIKE :search
        OR LOWER(address.city) LIKE :search
        OR LOWER(address.state) LIKE :search
        OR LOWER(ARRAY_TO_STRING(employment.jobTitle, ' ')) LIKE :search)`,
        { search: `%${search.toLowerCase()}%` },
      );
    }

    const [staffs, total] = await query.getManyAndCount();

    // Fetch assignments for these staffs in ONE query
    const staffIds = staffs.map((s) => s.id);

    const assignments =
      staffIds.length > 0
        ? await this.assignmentRepo.find({
          where: { staff: { id: In(staffIds) } },
          relations: ['task'],
        })
        : [];

    const COMPLETED_STATUSES: TaskStatus[] = [
      TaskStatus.COMPLETED,
      TaskStatus.Dev_COMPLETED,
      TaskStatus.Dev_Setup_Completed,
    ];

    // Group assignments by staffId
    const staffMap = new Map<number, { totalTasks: number; completedTasks: number }>();
    staffIds.forEach((id) => staffMap.set(id, { totalTasks: 0, completedTasks: 0 }));

    assignments.forEach((assignment) => {
      const staffId = assignment.staff?.id;
      const task = assignment.task;
      if (!staffId || !task) return;

      const record = staffMap.get(staffId);
      if (!record) return;
      record.totalTasks += 1;
      if (COMPLETED_STATUSES.includes(task.status)) {
        record.completedTasks += 1;
      }
    });

    // Enrich each staff record with task performance + new-hire metadata
    const enrichedStaffs = staffs.map((staff) => {
      const stats = staffMap.get(staff.id) || { totalTasks: 0, completedTasks: 0 };

      const completionRate =
        stats.totalTasks > 0
          ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
          : 0;

      let level = 'RED';
      let colorCode = '#FF2802';

      if (stats.totalTasks === 0) {
        level = 'PINK';
        colorCode = '#FF69B4';
      } else if (completionRate >= 86) {
        level = 'GREEN';
        colorCode = '#00C950';
      } else if (completionRate >= 50) {
        level = 'YELLOW';
        colorCode = '#EDD328';
      }

      const hireDate = staff.employment?.hireDate
        ? new Date(staff.employment.hireDate)
        : null;
      const daysOnBoard = hireDate
        ? Math.floor(
          (Date.now() - hireDate.getTime()) / (1000 * 60 * 60 * 24),
        )
        : null;

      return {
        ...staff,
        currentStatus: staff.isOnline ? 'Online' : 'Offline',
        newHire: {
          daysOnBoard,
          hireDate: staff.employment?.hireDate ?? null,
          isNewHire: true,
        },
        taskPerformance: {
          totalTasks: stats.totalTasks,
          completedTasks: stats.completedTasks,
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
        },
      };
    });

    return {
      data: enrichedStaffs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      meta: {
        filterDays: days,
        cutoffDate: cutoffStr,
        description: `Staff hired within the last ${days} days`,
      },
    };
  }
  // ────────────────────────────────────────────────────────────────────────────

  async getAllStaffswithDepartments(
    page: number,
    limit: number,
    search?: string,
  ) {
    const query = this.staffRepo
      .createQueryBuilder('staff')
      .leftJoinAndSelect('staff.employment', 'employment')
      .leftJoinAndSelect('employment.department', 'department')
      .leftJoinAndSelect('employment.departmentalRole', 'departmentalRole')
      .leftJoinAndSelect('staff.address', 'address')
      .orderBy('staff.firstName', 'ASC')
      .addOrderBy('staff.lastName', 'ASC')
      .addOrderBy('department.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    // ✅ Add search if provided
    if (search) {
      query.andWhere(
        `(LOWER(staff.firstName) LIKE :search
        OR LOWER(staff.lastName) LIKE :search
        OR LOWER(department.name) LIKE :search
         OR LOWER(departmentalRole.title) LIKE :search
        OR LOWER(address.city) LIKE :search
        OR LOWER(address.state) LIKE :search
        OR LOWER(ARRAY_TO_STRING(employment.jobTitle, ' ')) LIKE :search)

        `,
        { search: `%${search.toLowerCase()}%` },
      );
    }

    const [data, total] = await query.getManyAndCount();

    const enrichedData = data.map((staff) => ({
      ...staff,
      currentStatus: staff.isOnline ? 'Online' : 'Offline',
    }));

    return {
      data: enrichedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllStaffswithDepartmentsWithoutsearch(page: number, limit: number) {
    const [data, total] = await this.staffRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,

      order: {
        firstName: 'ASC',
        lastName: 'ASC',
        employment: {
          department: { name: 'ASC' },
        },
      },
      relations: [
        'employment',
        'employment.department',
        'employment.departmentalRole',
        'address',
      ],
    });

    const enrichedData = data.map((staff) => ({
      ...staff,
      currentStatus: staff.isOnline ? 'Online' : 'Offline',
    }));

    return {
      data: enrichedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
  async getAllStaffs(page: number, limit: number, search?: string) {
    const query = this.staffRepo
      .createQueryBuilder('staff')
      .leftJoinAndSelect('staff.employment', 'employment')
      .leftJoinAndSelect('employment.department', 'department')
      .leftJoinAndSelect('employment.departmentalRole', 'departmentalRole')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('staff.firstName', 'ASC')
      .addOrderBy('staff.lastName', 'ASC');

    if (search) {
      query.andWhere(
        `(LOWER(staff.firstName) LIKE :search
        OR LOWER(staff.lastName) LIKE :search

        OR LOWER(department.name) LIKE :search
        OR LOWER(departmentalRole.title) LIKE :search)`,
        { search: `%${search.toLowerCase()}%` },
      );
    }

    const [data, total] = await query.getManyAndCount();

    const enrichedData = data.map((staff) => ({
      ...staff,
      currentStatus: staff.isOnline ? 'Online' : 'Offline',
    }));

    return {
      data: enrichedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAllStaffsWithoutsearch(page: number, limit: number) {
    const [data, total] = await this.staffRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: {
        firstName: 'ASC',
        lastName: 'ASC',
      },
      // order: { createdAt: 'DESC' },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
  // 2) Birthdays
  async getTodayBirthdays() {
    const today = dayjs().format('MM-DD');
    return this.staffRepo
      .createQueryBuilder('staff')
      .leftJoinAndSelect('staff.employment', 'employment')
      .leftJoinAndSelect('employment.department', 'department')
      .leftJoinAndSelect('employment.departmentalRole', 'departmentalRole')
      .where(`TO_CHAR(staff.dateOfBirth, 'MM-DD') = :today`, { today })
      .getMany();
  }
  async getThisWeekBirthdays() {
    const start = dayjs().startOf('week').format('MM-DD');
    const end = dayjs().endOf('week').format('MM-DD');

    return this.staffRepo
      .createQueryBuilder('staff')
      .where(`TO_CHAR(staff.dateOfBirth, 'MM-DD') BETWEEN :start AND :end`, {
        start,
        end,
      })
      .getMany();
  }

  async getThisMonthBirthdays() {
    const month = dayjs().format('MM');
    return this.staffRepo
      .createQueryBuilder('staff')
      .where(`TO_CHAR(staff.dateOfBirth, 'MM') = :month`, { month })
      .getMany();
  }

  async getAllBirthdayCelebrants() {
    return {
      today: await this.getTodayBirthdays(),
      week: await this.getThisWeekBirthdays(),
      month: await this.getThisMonthBirthdays(),
    };
  }

  // 3) Anniversaries (hireDate is in StaffEmployment relation)
  async getYearlyAnniversaries() {
    const today = dayjs().format('MM-DD');
    return this.staffRepo
      .createQueryBuilder('staff')
      .leftJoinAndSelect('staff.employment', 'employment')
      .where(`TO_CHAR(employment.hireDate, 'MM-DD') = :today`, { today })
      .getMany();
  }

  async getQuarterlyAnniversaries() {
    const currentQuarter = Math.ceil((dayjs().month() + 1) / 3);
    return this.staffRepo
      .createQueryBuilder('staff')
      .leftJoinAndSelect('staff.employment', 'employment')
      .where(`EXTRACT(QUARTER FROM employment.hireDate) = :quarter`, {
        quarter: currentQuarter,
      })
      .getMany();
  }

  async getAllAnniversaries() {
    return {
      yearly: await this.getYearlyAnniversaries(),
      quarterly: await this.getQuarterlyAnniversaries(),
    };
  }
  async getStats() {
    const totalEmployees = await this.staffRepo.count();
    const totalDepartments = await this.departmentRepo.count();
    const totalProjects = await this.projectRepo.count();

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1–12

    // 🎂 Birthdays happening this month (any year)
    const birthdays = await this.staffRepo
      .createQueryBuilder('staff')
      .where('EXTRACT(MONTH FROM staff.dateOfBirth) = :month', {
        month: currentMonth,
      })
      .getCount();

    // 🎉 Anniversaries this quarter
    const currentQuarter = Math.floor((now.getMonth() + 3) / 3); // 1–4
    const quarterStartMonth = (currentQuarter - 1) * 3 + 1;
    const quarterEndMonth = quarterStartMonth + 2;

    const anniversaries = await this.employmentRepo
      .createQueryBuilder('employment')
      .where(
        'EXTRACT(MONTH FROM employment.hireDate) BETWEEN :start AND :end',
        { start: quarterStartMonth, end: quarterEndMonth },
      )
      .getCount();

    return {
      totalEmployees,
      totalDepartments,
      totalProjects,
      birthdays,
      anniversaries,
    };
  }

  async getStatsTat() {
    const totalEmployees = await this.staffRepo.count();
    const totalDepartments = await this.departmentRepo.count();
    const totalProjects = await this.projectRepo.count();

    // 🎂 Birthdays this month
    const now = new Date();
    const month = now.getMonth() + 1; // 1–12
    const birthdays = await this.staffRepo
      .createQueryBuilder('staff')
      .where('EXTRACT(MONTH FROM staff.dateOfBirth) = :month', { month })
      .getCount();

    // 🎉 Anniversaries this quarter
    const currentQuarter = Math.floor((now.getMonth() + 3) / 3); // 1–4
    const quarterStartMonth = (currentQuarter - 1) * 3 + 1;
    const quarterEndMonth = quarterStartMonth + 2;

    const anniversaries = await this.employmentRepo
      .createQueryBuilder('employment')
      .where(
        'EXTRACT(MONTH FROM employment.hireDate) BETWEEN :start AND :end',
        { start: quarterStartMonth, end: quarterEndMonth },
      )
      .getCount();

    return {
      totalEmployees,
      totalDepartments,
      totalProjects,
      birthdays,
      anniversaries,
    };
  }
  async getUpcomingBirthdays(
    page = 1,
    limit = 4,
  ): Promise<{
    data: StaffBirthdayDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const staff = await this.staffRepo.find();
    const today = new Date();

    const staffWithNextBirthday = staff.map((person) => {
      const dob = new Date(person.dateOfBirth);

      // Build this year's birthday
      let nextBirthday = new Date(
        today.getFullYear(),
        dob.getMonth(),
        dob.getDate(),
      );

      // If already passed, set for next year
      if (
        nextBirthday.getMonth() < today.getMonth() ||
        (nextBirthday.getMonth() === today.getMonth() &&
          nextBirthday.getDate() < today.getDate())
      ) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
      }

      const dto = new StaffBirthdayDto();
      Object.assign(dto, person, { nextBirthday });

      return dto;
    });

    // Sort by soonest
    const sorted = staffWithNextBirthday.sort(
      (a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime(),
    );

    // Pagination
    const start = (page - 1) * limit;
    const data = sorted.slice(start, start + limit);

    return {
      data,
      total: sorted.length,
      page,
      limit,
    };
  }

  async getUpcomingBirthdaysWithoutPagination(): Promise<StaffBirthdayDto[]> {
    const staff = await this.staffRepo.find();
    const today = new Date();

    const staffWithNextBirthday = staff.map((person) => {
      const dob = new Date(person.dateOfBirth);

      // Build this year's birthday
      let nextBirthday = new Date(
        today.getFullYear(),
        dob.getMonth(),
        dob.getDate(),
      );

      // If already passed, set for next year
      if (
        nextBirthday.getMonth() < today.getMonth() ||
        (nextBirthday.getMonth() === today.getMonth() &&
          nextBirthday.getDate() < today.getDate())
      ) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
      }

      const dto = new StaffBirthdayDto();
      Object.assign(dto, person, { nextBirthday });

      return dto;
    });

    // Sort by soonest upcoming birthday
    return staffWithNextBirthday.sort(
      (a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime(),
    );
  }

  async getUpcomingAnniversariesNotPaginated(): Promise<StaffAnniversaryDto[]> {
    const staff = await this.staffRepo.find();
    const today = new Date();

    const staffWithNextAnniversary = staff
      .map((person) => {
        if (!person.employment?.hireDate) return null;

        const hireDate = new Date(person.employment.hireDate);

        // Build this year's anniversary
        let nextAnniversary = new Date(
          today.getFullYear(),
          hireDate.getMonth(),
          hireDate.getDate(),
        );

        // If already passed this year, set for next year
        if (
          nextAnniversary.getMonth() < today.getMonth() ||
          (nextAnniversary.getMonth() === today.getMonth() &&
            nextAnniversary.getDate() < today.getDate())
        ) {
          nextAnniversary.setFullYear(today.getFullYear() + 1);
        }

        // Years completed until today
        const yearsCompleted = today.getFullYear() - hireDate.getFullYear();

        const dto = new StaffAnniversaryDto();
        Object.assign(dto, person, { nextAnniversary, yearsCompleted });

        return dto;
      })
      // ✅ Explicit type predicate ensures TypeScript knows nulls are removed
      .filter((dto): dto is StaffAnniversaryDto => dto !== null);

    // Sort by closest upcoming anniversary
    return staffWithNextAnniversary.sort(
      (a, b) => a.nextAnniversary.getTime() - b.nextAnniversary.getTime(),
    );
  }
  async findTodaysBirthdays(): Promise<Staff[]> {
    // Get current Nigeria time
    const today = moment().tz('Africa/Lagos');

    const month = today.month() + 1; // moment months are 0-based
    const day = today.date();

    return this.staffRepo
      .createQueryBuilder('staff')
      .where('EXTRACT(MONTH FROM staff.dateOfBirth) = :month', { month })
      .andWhere('EXTRACT(DAY FROM staff.dateOfBirth) = :day', { day })
      .getMany();
  }
  async findTodaysBirthdaysDBtimezone(): Promise<Staff[]> {
    const today = new Date();
    const month = today.getMonth() + 1; // Months are 0-based
    const day = today.getDate();

    return this.staffRepo
      .createQueryBuilder('staff')
      .where('EXTRACT(MONTH FROM staff.dateOfBirth) = :month', { month })
      .andWhere('EXTRACT(DAY FROM staff.dateOfBirth) = :day', { day })
      .getMany();
  }

  async findTodaysAnniversary(): Promise<Staff[]> {
    const today = new Date();
    const month = today.getMonth() + 1; // JS months are 0-based
    const day = today.getDate();

    // Fetch all staff and filter anniversaries by hireDate month/day
    const allStaff = await this.staffRepo.find({
      relations: [
        'employment',
        'employment.department',
        'employment.departmentalRole',
      ],
    });

    return allStaff.filter((staff) => {
      if (!staff.employment?.hireDate) return false;

      const hireDate = new Date(staff.employment.hireDate);
      return hireDate.getDate() === day && hireDate.getMonth() + 1 === month;
    });
  }
  // staff-register.service.ts

  async findThisMonthAnniversaryNotPaginated(): Promise<any[]> {
    const today = new Date();
    const month = today.getMonth() + 1;

    const allStaff = await this.staffRepo.find({
      relations: [
        'employment',
        'employment.department',
        'employment.departmentalRole',
      ],
    });

    return (
      allStaff
        .filter((staff) => {
          if (!staff.employment?.hireDate) return false;
          const hireDate = new Date(staff.employment.hireDate);
          return hireDate.getMonth() + 1 === month;
        })
        .map((staff) => {
          const hireDate = new Date(staff.employment.hireDate);

          // compute this year's anniversary
          const thisYearAnniversary = new Date(
            today.getFullYear(),
            hireDate.getMonth(),
            hireDate.getDate(),
          );

          // if it's already passed, next anniversary is still this year
          const nextAnniversary =
            thisYearAnniversary < today
              ? new Date(
                today.getFullYear(),
                hireDate.getMonth(),
                hireDate.getDate(),
              )
              : thisYearAnniversary;

          const yearsCompleted = today.getFullYear() - hireDate.getFullYear();

          return {
            id: staff.id,
            firstName: staff.firstName,
            lastName: staff.lastName,
            photoUrl: staff.photoUrl,
            nextAnniversary,
            yearsCompleted,
          };
        })
        // ✅ sort by day of month ascending
        .sort(
          (a, b) => a.nextAnniversary.getDate() - b.nextAnniversary.getDate(),
        )
    );
  }

  async getRecentAnniversariesNotPaginated(): Promise<
    StaffRecentAnniversaryDto[]
  > {
    const staff = await this.staffRepo.find();
    const today = new Date();

    const staffWithLastAnniversary = staff
      .map((person) => {
        if (!person.employment?.hireDate) return null;

        const hireDate = new Date(person.employment.hireDate);

        // Build this year's anniversary
        let lastAnniversary = new Date(
          today.getFullYear(),
          hireDate.getMonth(),
          hireDate.getDate(),
        );

        // If not yet reached this year, set for last year
        if (
          lastAnniversary.getMonth() > today.getMonth() ||
          (lastAnniversary.getMonth() === today.getMonth() &&
            lastAnniversary.getDate() > today.getDate())
        ) {
          lastAnniversary.setFullYear(today.getFullYear() - 1);
        }

        // Years completed up to this last anniversary
        const yearsCompleted =
          lastAnniversary.getFullYear() - hireDate.getFullYear();

        const dto = new StaffRecentAnniversaryDto();
        Object.assign(dto, person, { lastAnniversary, yearsCompleted });

        return dto;
      })
      .filter((dto): dto is StaffRecentAnniversaryDto => dto !== null);

    // Sort by most recent past anniversary
    return staffWithLastAnniversary.sort(
      (a, b) => b.lastAnniversary.getTime() - a.lastAnniversary.getTime(),
    );
  }

  ///////paginated staff anniversaries
  async findThisMonthAnniversary(
    page = 1,
    limit = 10,
  ): Promise<PaginatedResult<any>> {
    const today = new Date();
    const month = today.getMonth() + 1;

    const allStaff = await this.staffRepo.find({
      relations: [
        'employment',
        'employment.department',
        'employment.departmentalRole',
      ],
    });

    const anniversaries = allStaff
      .filter((staff) => {
        if (!staff.employment?.hireDate) return false;
        const hireDate = new Date(staff.employment.hireDate);
        return hireDate.getMonth() + 1 === month;
      })
      .map((staff) => {
        const hireDate = new Date(staff.employment.hireDate);

        // compute this year's anniversary
        const thisYearAnniversary = new Date(
          today.getFullYear(),
          hireDate.getMonth(),
          hireDate.getDate(),
        );

        // if it's already passed, keep it as this year's date
        const nextAnniversary =
          thisYearAnniversary < today
            ? new Date(
              today.getFullYear(),
              hireDate.getMonth(),
              hireDate.getDate(),
            )
            : thisYearAnniversary;

        const yearsCompleted = today.getFullYear() - hireDate.getFullYear();

        return {
          id: staff.id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          photoUrl: staff.photoUrl,
          nextAnniversary,
          yearsCompleted,
        };
      })
      // ✅ sort by day in ascending order
      .sort(
        (a, b) => a.nextAnniversary.getDate() - b.nextAnniversary.getDate(),
      );

    // ✅ apply pagination
    const total = anniversaries.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      data: anniversaries.slice(start, end),
      total,
      page,
      limit,
    };
  }
  async getUpcomingAnniversaries(
    page = 1,
    limit = 10,
  ): Promise<PaginatedResult<StaffAnniversaryDto>> {
    const staff = await this.staffRepo.find();
    const today = new Date();

    const staffWithNextAnniversary = staff
      .map((person) => {
        if (!person.employment?.hireDate) return null;

        const hireDate = new Date(person.employment.hireDate);

        let nextAnniversary = new Date(
          today.getFullYear(),
          hireDate.getMonth(),
          hireDate.getDate(),
        );
        if (
          nextAnniversary.getMonth() < today.getMonth() ||
          (nextAnniversary.getMonth() === today.getMonth() &&
            nextAnniversary.getDate() < today.getDate())
        ) {
          nextAnniversary.setFullYear(today.getFullYear() + 1);
        }

        const yearsCompleted = today.getFullYear() - hireDate.getFullYear();

        const dto = new StaffAnniversaryDto();
        Object.assign(dto, person, { nextAnniversary, yearsCompleted });
        return dto;
      })
      .filter((dto): dto is StaffAnniversaryDto => dto !== null)
      .sort(
        (a, b) => a.nextAnniversary.getTime() - b.nextAnniversary.getTime(),
      );

    const total = staffWithNextAnniversary.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      data: staffWithNextAnniversary.slice(start, end),
      total,
      page,
      limit,
    };
  }

  async getRecentAnniversaries(
    page = 1,
    limit = 10,
  ): Promise<PaginatedResult<StaffRecentAnniversaryDto>> {
    const staff = await this.staffRepo.find();
    const today = new Date();

    const staffWithLastAnniversary = staff
      .map((person) => {
        if (!person.employment?.hireDate) return null;

        const hireDate = new Date(person.employment.hireDate);

        let lastAnniversary = new Date(
          today.getFullYear(),
          hireDate.getMonth(),
          hireDate.getDate(),
        );
        if (
          lastAnniversary.getMonth() > today.getMonth() ||
          (lastAnniversary.getMonth() === today.getMonth() &&
            lastAnniversary.getDate() > today.getDate())
        ) {
          lastAnniversary.setFullYear(today.getFullYear() - 1);
        }

        const yearsCompleted =
          lastAnniversary.getFullYear() - hireDate.getFullYear();

        const dto = new StaffRecentAnniversaryDto();
        Object.assign(dto, person, { lastAnniversary, yearsCompleted });
        return dto;
      })
      .filter((dto): dto is StaffRecentAnniversaryDto => dto !== null)
      .sort(
        (a, b) => b.lastAnniversary.getTime() - a.lastAnniversary.getTime(),
      );

    const total = staffWithLastAnniversary.length;
    const start = (page - 1) * limit;
    const end = start + limit;

    return {
      data: staffWithLastAnniversary.slice(start, end),
      total,
      page,
      limit,
    };
  }

  async getStaffByDepartmentOrRoleOrJobTitle(name: string) {
    // Normalize search term (case-insensitive)
    const searchTerm = name.toLowerCase();

    return (
      this.staffRepo
        .createQueryBuilder('staff')
        .leftJoinAndSelect('staff.employment', 'employment')
        .leftJoinAndSelect('employment.department', 'department')
        .leftJoinAndSelect('employment.departmentalRole', 'departmentalRole')
        .leftJoinAndSelect('staff.address', 'address')
        .where('LOWER(department.name) LIKE :searchTerm', {
          searchTerm: `%${searchTerm}%`,
        })
        .orWhere('LOWER(departmentalRole.title) LIKE :searchTerm', {
          searchTerm: `%${searchTerm}%`,
        })
        // jobTitle is a Postgres array, so we use ANY() to check if any element matches
        .orWhere(
          'EXISTS (SELECT 1 FROM unnest(employment.jobTitle) AS jt WHERE LOWER(jt) LIKE :searchTerm)',
          { searchTerm: `%${searchTerm}%` },
        )
        .getMany()
    );
  }

  async populateMissingUuids() {
    const staffsWithoutUuid = await this.staffRepo.find({
      where: { uuid: IsNull() },
    });

    if (!staffsWithoutUuid.length) {
      return { message: '✅ All staff already have UUIDs' };
    }

    for (const staff of staffsWithoutUuid) {
      staff.uuid = uuidv4();
      await this.staffRepo.save(staff);
    }

    return {
      message: `✅ UUIDs added for ${staffsWithoutUuid.length} staff record(s).`,
    };
  }

  async forgotPassword(email: string, req?: Request) {
    const staff = await this.staffRepo.findOne({ where: { email } });

    if (!staff) {
      throw new NotFoundException('No staff found with this email');
    }

    // generate token

    const token = uuidv4();
    // const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    staff.resetToken = token;
    staff.resetTokenExpires = expires;

    await this.staffRepo.save(staff);

    await this.mailService.sendPasswordResetEmail(staff.email, token);
    // Log forgot password request
    await this.activityService.logActivity(
      staff.id,
      'Forgot Password Request',
      'Success',
      req,
    );

    return {
      message:
        'Password reset link sent successfully to your registered email address',
    };
  }
  async resetPassword(token: string, newPassword: string, req?: Request) {
    const staff: any = await this.staffRepo.findOne({
      where: { resetToken: token },
    });

    if (!staff) {
      throw new BadRequestException('Invalid token');
    }

    if (staff.resetTokenExpires < new Date()) {
      throw new BadRequestException('Reset token expired');
    }

    // update password
    const salt = await bcrypt.genSalt(10);
    staff.password = await bcrypt.hash(newPassword, salt);

    // clear reset fields
    staff.resetToken = null;
    staff.resetTokenExpires = null;

    await this.staffRepo.save(staff);

    // Log password reset
    await this.activityService.logActivity(
      staff.id,
      'Password Reset',
      'Success',
      req,
    );

    return { message: 'Password successfully reset' };
  }

  async verifyRegistrationToken(token: string) {
    if (!token) {
      throw new BadRequestException('Token is required');
    }

    const staff = await this.staffRepo.findOne({
      where: { registrationToken: token },
    });

    if (!staff) {
      return { valid: false, expired: false, message: 'Invalid registration token' };
    }

    if (!staff.registrationTokenExpires || staff.registrationTokenExpires < new Date()) {
      return {
        valid: false,
        expired: true,
        email: staff.email,
        message: 'Registration token has expired (valid for 15 minutes)',
      };
    }

    return {
      valid: true,
      expired: false,
      email: staff.email,
    };
  }

  async completeRegistration(dto: { token: string; oldPassword?: string; newPassword?: string; confirmPassword?: string }, req?: Request) {
    const { token, oldPassword, newPassword, confirmPassword } = dto;

    if (!token || !oldPassword || !newPassword || !confirmPassword) {
      throw new BadRequestException('All fields (token, old password, new password, confirm password) are required');
    }

    if (newPassword !== confirmPassword) {
      throw new BadRequestException('New password and confirm password do not match');
    }

    const staff = await this.staffRepo.findOne({
      where: { registrationToken: token },
    });

    if (!staff) {
      throw new BadRequestException('Invalid registration token');
    }

    if (!staff.registrationTokenExpires || staff.registrationTokenExpires < new Date()) {
      throw new BadRequestException('REGISTRATION_OTP_EXPIRED');
    }

    // Verify old password against stored hashed password
    const isOldValid = await bcrypt.compare(oldPassword, staff.password);
    if (!isOldValid) {
      throw new BadRequestException('Incorrect default/generated old password');
    }

    // Update to new password
    const salt = await bcrypt.genSalt(10);
    staff.password = await bcrypt.hash(newPassword, salt);

    // Clear registration token and mark registered
    staff.registrationToken = undefined as any;
    staff.registrationTokenExpires = undefined as any;
    staff.isRegistered = true;

    await this.staffRepo.save(staff);

    await this.activityService.logActivity(
      staff.id,
      'Registration Completed',
      'Success',
      req,
    );

    return { message: 'Registration completed successfully! You can now log in.' };
  }

  async softDeleteStaff(id: number, userId: string): Promise<void> {
    // check admin
    const admin = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!admin || admin.isAdmin !== true) {
      throw new NotFoundException(
        'Only Admins are authorized to perform this task',
      );
    }

    const staff = await this.staffRepo.findOne({ where: { id } });

    if (!staff) {
      throw new NotFoundException('Staff not found');
    }

    await this.staffRepo.softDelete(id);
  }

  // Restore soft-deleted staff
  async restoreStaff(id: number, userId: string): Promise<void> {
    const admin = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!admin || admin.isAdmin !== true) {
      throw new NotFoundException(
        'Only Admins are authorized to perform this task',
      );
    }
    const result = await this.staffRepo.restore(id);

    if (!result.affected) {
      throw new NotFoundException('Staff not found or not deleted');
    }
  }

  async findAllIncludingDeleted(): Promise<Staff[]> {
    return this.staffRepo.find({ withDeleted: true });
  }

  // Get only deleted staff
  async findDeletedStaff(): Promise<Staff[]> {
    return this.staffRepo.find({
      withDeleted: true,
      where: {
        deletedAt: Not(IsNull()),
      },
    });
  }
}
