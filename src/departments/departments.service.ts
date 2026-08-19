import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Department } from './entities/department.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Admin } from 'src/admin/entities/admin.entity';

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  async create(
    createDepartmentDto: CreateDepartmentDto,
    userId: string,
  ): Promise<Department> {
    try {
      const admin = await this.adminRepository.findOne({
        where: { id: Number(userId) },
      });
      if (!admin || admin.isAdmin !== true)
        throw new NotFoundException(
          'Only Admins are Authorized to perform task',
        );

      const exists = await this.departmentRepository.findOne({
        where: { name: createDepartmentDto.name },
      });
      if (exists) throw new BadRequestException('Department already exists');

      const department = this.departmentRepository.create(createDepartmentDto);
      return this.departmentRepository.save(department);
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

  async findAll(): Promise<Department[]> {
    return this.departmentRepository.find({
      order: { id: 'DESC' },
    });
  }

  async findOne(id: number): Promise<Department> {
    const department = await this.departmentRepository.findOne({
      where: { id },
    });
    if (!department)
      throw new NotFoundException(`Department with ID ${id} not found`);
    return department;
  }

  async update(
    id: number,
    updateDepartmentDto: UpdateDepartmentDto,
    userId: string,
  ): Promise<Department> {
    const admin = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!admin || admin.isAdmin !== true)
      throw new NotFoundException('Only Admins are Authorized to perform task');

    const department = await this.findOne(id);
    Object.assign(department, updateDepartmentDto);
    return this.departmentRepository.save(department);
  }

  async remove(id: number, userId: string): Promise<void> {
    const admin = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!admin || admin.isAdmin !== true)
      throw new NotFoundException('Only Admins are Authorized to perform task');

    const department = await this.findOne(id);
    await this.departmentRepository.remove(department);
  }
}
