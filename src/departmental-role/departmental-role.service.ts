import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDepartmentalRoleDto } from './dto/create-departmental-role.dto';
import { UpdateDepartmentalRoleDto } from './dto/update-departmental-role.dto';
import { DepartmentalRole } from './entities/departmental-role.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from 'src/admin/entities/admin.entity';
import { Department } from 'src/departments/entities/department.entity';
import { StaffEmployment } from 'src/staff-register/entities/staff-employment.entity';

@Injectable()
export class DepartmentalRoleService {
  constructor(
    @InjectRepository(DepartmentalRole)
    private readonly departmentalRoleRepo: Repository<DepartmentalRole>,
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    @InjectRepository(StaffEmployment)
    private readonly staffEmploymentRepo: Repository<StaffEmployment>,
  ) {}

  async create(
    dto: CreateDepartmentalRoleDto,
    userId: string,
  ): Promise<DepartmentalRole> {
    const { title, description } = dto;

    try {
      // Validate title
      if (!title) {
        throw new BadRequestException('Departmental role must have a title');
      }

      // Validate departmentId
      if (!dto.department) {
        throw new BadRequestException('Department ID is required');
      }

      // Validate admin user
      const admin = await this.adminRepository.findOne({
        where: { id: Number(userId) },
      });
      if (!admin || admin.isAdmin !== true) {
        throw new NotFoundException(
          'Only admins are authorized to perform this task',
        );
      }

      // Ensure role with same title doesn’t exist
      const exists = await this.departmentalRoleRepo.findOne({
        where: { title },
      });
      if (exists) {
        throw new BadRequestException(
          'Departmental role with this title already exists',
        );
      }

      // Fetch department
      const department = await this.departmentRepository.findOne({
        where: { id: dto.department },
      });
      if (!department) {
        throw new NotFoundException('Department not found');
      }

      // Create role
      const role = this.departmentalRoleRepo.create({
        title,
        description,
        department,
      });

      return await this.departmentalRoleRepo.save(role);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException('Server error');
    }
  }

  async findAll(): Promise<DepartmentalRole[]> {
    return await this.departmentalRoleRepo.find({
      relations: ['department'],
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number): Promise<DepartmentalRole> {
    const role = await this.departmentalRoleRepo.findOne({
      where: { id },
      relations: ['department'],
    });
    if (!role) throw new NotFoundException(`Role with ID ${id} not found`);
    return role;
  }
  async update(
    id: number,
    dto: UpdateDepartmentalRoleDto,
  ): Promise<DepartmentalRole> {
    const role = await this.findOne(id);

    if (dto.department) {
      const department = await this.departmentRepository.findOne({
        where: { id: dto.department },
      });
      if (!department) {
        throw new NotFoundException('Department not found');
      }
      role.department = department;
    }

    if (dto.title) role.title = dto.title;
    if (dto.description) role.description = dto.description;

    return this.departmentalRoleRepo.save(role);
  }

  async remove(id: number): Promise<any> {
    await this.findOne(id);
    await this.departmentalRoleRepo.delete(id);
    return {
      message: 'Delete successful',
    };
  }
  async getJobTitlesByDepartmentalRole(roleId: number) {
    const role = await this.departmentalRoleRepo.findOne({
      where: { id: roleId },
    });
    if (!role) throw new NotFoundException('Departmental role not found');

    const employments = await this.staffEmploymentRepo.find({
      where: { departmentalRole: { id: roleId } },
    });

    const titles = new Set<string>();
    for (const emp of employments) {
      if (Array.isArray(emp.jobTitle)) {
        emp.jobTitle.forEach((title) => titles.add(title.trim()));
      }
    }

    return Array.from(titles);
  }

  // 2 Ensure no job title duplicates across any DepartmentalRole
  async validateJobTitlesUniqueness(jobTitles: string[]) {
    if (!jobTitles?.length) return;

    const allEmployments = await this.staffEmploymentRepo.find();
    const existingTitles = new Set<string>();

    for (const emp of allEmployments) {
      emp.jobTitle?.forEach((title) =>
        existingTitles.add(title.trim().toLowerCase()),
      );
    }

    const duplicates = jobTitles.filter((t) =>
      existingTitles.has(t.trim().toLowerCase()),
    );

    if (duplicates.length > 0) {
      throw new BadRequestException(
        `The following job titles already exist: ${duplicates.join(', ')}`,
      );
    }
  }
}
