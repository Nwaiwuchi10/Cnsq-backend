import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateHeadOfDepartmentDto } from './dto/create-headofdepartment.dto';
import { UpdateHeadofdepartmentDto } from './dto/update-headofdepartment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Admin } from 'src/admin/entities/admin.entity';
import { Repository } from 'typeorm';
import { Department } from 'src/departments/entities/department.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { HeadOfDepartment } from './entities/headofdepartment.entity';

@Injectable()
export class HeadofdepartmentService {
  constructor(
    @InjectRepository(HeadOfDepartment)
    private hodRepository: Repository<HeadOfDepartment>,

    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,

    @InjectRepository(Department)
    private deptRepository: Repository<Department>,

    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  async create(
    dto: CreateHeadOfDepartmentDto,
    userId: string,
  ) {
    const admin = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!admin || admin.isAdmin !== true) {
      throw new NotFoundException('Only Admins are authorized to perform task');
    }

    const staff = await this.staffRepository.findOne({
      where: { id: dto.staffId },
    });
    if (!staff) throw new NotFoundException('Staff not found');

    const department = await this.deptRepository.findOne({
      where: { id: dto.departmentId },
    });
    if (!department) throw new NotFoundException('Department not found');

    const existing = await this.hodRepository.findOne({
      where: { department: { id: dto.departmentId }, staff: { id: dto.staffId } },
    });
    if (existing) {
      throw new BadRequestException(
        'This staff is already assigned as a Head for this department',
      );
    }

    const hod = this.hodRepository.create({
      staff,
      department,
      name: dto.name,
    });
    return this.hodRepository.save(hod);
  }

  // === FIND ALL ===
  findAll() {
    return this.hodRepository.find({
      order: { id: 'DESC' },
      relations: ['staff', 'department'],
    });
  }

  // === FIND ONE ===
  async findOne(id: number) {
    const hod = await this.hodRepository.findOne({ where: { id } });
    if (!hod) throw new NotFoundException('HOD not found');
    return hod;
  }

  // === UPDATE ===
  async update(id: number, dto: UpdateHeadofdepartmentDto, userId: string) {
    const admin = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!admin || admin.isAdmin !== true) {
      throw new NotFoundException('Only Admins are authorized to perform task');
    }

    const hod = await this.hodRepository.findOne({ where: { id } });
    if (!hod) throw new NotFoundException('HOD not found');

    if (dto.staffId) {
      const staff = await this.staffRepository.findOne({
        where: { id: dto.staffId },
      });
      if (!staff) throw new NotFoundException('Staff not found');
      hod.staff = staff;
    }

    if (dto.departmentId) {
      const dept = await this.deptRepository.findOne({
        where: { id: dto.departmentId },
      });
      if (!dept) throw new NotFoundException('Department not found');
      hod.department = dept;
    }

    if (dto.name !== undefined) {
      hod.name = dto.name;
    }

    return this.hodRepository.save(hod);
  }

  // === DELETE ===
  async remove(id: number, userId: string) {
    const admin = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!admin || admin.isAdmin !== true) {
      throw new NotFoundException('Only Admins are authorized to perform task');
    }

    const hod = await this.hodRepository.findOne({ where: { id } });
    if (!hod) throw new NotFoundException('HOD not found');

    await this.hodRepository.remove(hod);
    return {
      message: 'Delete successful',
    };
  }

  async findDepartmentsByStaff(staffId: number) {
    const records = await this.hodRepository.find({
      where: { staff: { id: staffId } },
      relations: ['department'],
    });
    return records.map((r) => r.department).filter(Boolean);
  }
}
