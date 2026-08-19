import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Documentation } from './entities/documentation.entity';
import { CreateDocumentationDto } from './dto/create-documentation.dto';
import { UpdateDocumentationDto } from './dto/update-documentation.dto';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Admin } from 'src/admin/entities/admin.entity';

@Injectable()
export class DocumentationService {
  constructor(
    @InjectRepository(Documentation)
    private readonly documentationRepo: Repository<Documentation>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
  ) { }

  private async checkProjectManagerOrAdmin(userId: number) {
    // 1. Check if the user is an admin by ID first
    let admin = await this.adminRepo.findOne({
      where: { id: Number(userId) },
    });

    if (admin && admin.isAdmin === true) {
      if (admin.staff) {
        return admin.staff;
      }
      // If admin doesn't have a linked staff, try finding by email
      const linkedStaff = await this.staffRepo.findOne({
        where: { email: admin.email },
      });
      if (linkedStaff) return linkedStaff;
    }

    /// 2. Check if the user is a staff
    const staff = await this.staffRepo.findOne({
      where: { id: Number(userId) },
      relations: ['roles'],
    });

    if (!staff) {
      throw new BadRequestException('User not found');
    }

    // 3. Even if not logged in as admin, check if this staff email belongs to an admin
    if (!admin) {
      admin = await this.adminRepo.findOne({
        where: { email: staff.email },
      });
    }

    if (admin && admin.isAdmin === true) {
      return staff;
    }

    const authorizedRoles = ['Project Manager', 'Departmental Head', 'HR'];

    // 4. Check if staff has any of the authorized roles
    const hasAuthorizedRole = staff.roles.some((role) =>
      authorizedRoles.includes(role.name),
    );

    if (!hasAuthorizedRole) {
      throw new BadRequestException(
        'Only Project Managers, Departmental Heads, HR, or Admins are authorized for this action',
      );
    }
    return staff;
  }

  async create(
    dto: CreateDocumentationDto,
    userId: number,
    files: string[] = [],
  ): Promise<Documentation> {
    const creator = await this.checkProjectManagerOrAdmin(userId);

    if (!dto.link && files.length === 0) {
      throw new BadRequestException(
        'Please provide either a documentation link or upload at least one file',
      );
    }

    const documentation = this.documentationRepo.create({
      ...dto,
      files,
      createdBy: creator as Staff,
    });

    return this.documentationRepo.save(documentation);
  }

  async findAll(
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<{ data: Documentation[]; total: number; page: number; limit: number }> {
    const query = this.documentationRepo
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.createdBy', 'createdBy');

    if (search) {
      query.andWhere(
        '(LOWER(doc.name) LIKE LOWER(:search) OR LOWER(doc.link) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await query
      .orderBy('doc.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Documentation> {
    const doc = await this.documentationRepo.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!doc) throw new NotFoundException('Documentation not found');
    return doc;
  }

  async update(
    id: string,
    dto: UpdateDocumentationDto,
    userId: number,
    newFiles: string[] = [],
  ): Promise<Documentation> {
    await this.checkProjectManagerOrAdmin(userId);

    const doc = await this.findOne(id);

    const updatedFiles = newFiles.length > 0
      ? [...(dto.files ?? doc.files ?? []), ...newFiles]
      : (dto.files ?? doc.files ?? []);

    if (!dto.link && updatedFiles.length === 0) {
      throw new BadRequestException(
        'Please provide either a documentation link or upload at least one file',
      );
    }

    if (newFiles.length > 0) {
      dto.files = updatedFiles;
    }

    Object.assign(doc, dto);
    return this.documentationRepo.save(doc);
  }

  async remove(id: string, userId: number): Promise<{ message: string }> {
    await this.checkProjectManagerOrAdmin(userId);

    const doc = await this.findOne(id);
    await this.documentationRepo.remove(doc);

    return { message: 'Documentation deleted successfully' };
  }
}
