import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { Permission } from './entities/permission.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Admin } from 'src/admin/entities/admin.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  async create(dto: CreatePermissionDto, userId: string): Promise<Permission> {
    const adminCreateRole: any = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!adminCreateRole || adminCreateRole.isAdmin !== true)
      throw new NotFoundException('Only Admins are Authorized to peform task');
    const exists = await this.permissionRepo.findOne({
      where: { action: dto.action },
    });
    if (exists) throw new ConflictException('Permission already exists');

    const permission = this.permissionRepo.create(dto);
    return this.permissionRepo.save(permission);
  }

  async findAll(): Promise<Permission[]> {
    return this.permissionRepo.find();
  }

  async findOne(id: number): Promise<Permission> {
    const permission = await this.permissionRepo.findOne({ where: { id } });
    if (!permission) throw new NotFoundException('Permission not found');
    return permission;
  }

  async update(
    id: number,
    dto: UpdatePermissionDto,
    userId: string,
  ): Promise<Permission> {
    const adminCreateRole: any = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!adminCreateRole || adminCreateRole.isAdmin !== true)
      throw new NotFoundException('Only Admins are Authorized to peform task');
    const permission = await this.findOne(id);
    Object.assign(permission, dto);
    return this.permissionRepo.save(permission);
  }

  async remove(id: number, userId: string): Promise<{ message: string }> {
    const adminCreateRole: any = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!adminCreateRole || adminCreateRole.isAdmin !== true)
      throw new NotFoundException('Only Admins are Authorized to peform task');
    const permission = await this.permissionRepo.findOne({ where: { id } });
    if (!permission) {
      throw new NotFoundException('Permission id not found');
    }
    await this.permissionRepo.remove(permission);
    return {
      message: `Permission with id ${id} has been successfully deleted`,
    };
  }
}
