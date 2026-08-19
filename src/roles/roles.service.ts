import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Role } from './entities/role.entity';
import { In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Admin } from 'src/admin/entities/admin.entity';
import { Permission } from 'src/permissions/entities/permission.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
    @InjectRepository(Admin)
    private adminRepository: Repository<Admin>,
  ) {}

  async create(dto: CreateRoleDto, userId: string): Promise<Role> {
    const adminCreateRole: any = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!adminCreateRole || adminCreateRole.isAdmin !== true)
      throw new NotFoundException('Only Admins are Authorized to peform task');
    const exists = await this.roleRepo.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Role already exists');

    // fetch or create permissions
    let permissions = await this.permissionRepo.find({
      where: { action: In(dto.permissions) },
    });

    // create missing permissions
    const existingActions = permissions.map((p) => p.action);
    const newActions = dto.permissions.filter(
      (p) => !existingActions.includes(p),
    );

    if (newActions.length) {
      const newPerms = this.permissionRepo.create(
        newActions.map((action) => ({ action })),
      );
      const savedPerms = await this.permissionRepo.save(newPerms);
      permissions = [...permissions, ...savedPerms];
    }

    const role = this.roleRepo.create({
      name: dto.name,
      permissions,
    });

    return this.roleRepo.save(role);
  }

  async findAll(): Promise<Role[]> {
    return this.roleRepo.find();
  }

  async findOne(id: number): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async update(id: number, dto: UpdateRoleDto, userId: string): Promise<Role> {
    const adminCreateRole: any = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!adminCreateRole || adminCreateRole.isAdmin !== true)
      throw new NotFoundException('Only Admins are Authorized to peform task');
    const role = await this.findOne(id);

    if (dto.name) role.name = dto.name;

    if (dto.permissions) {
      let permissions = await this.permissionRepo.find({
        where: { action: In(dto.permissions) },
      });

      const existingActions = permissions.map((p) => p.action);
      const newActions = dto.permissions.filter(
        (p) => !existingActions.includes(p),
      );

      if (newActions.length) {
        const newPerms = this.permissionRepo.create(
          newActions.map((action) => ({ action })),
        );
        const savedPerms = await this.permissionRepo.save(newPerms);
        permissions = [...permissions, ...savedPerms];
      }

      role.permissions = permissions;
    }

    return this.roleRepo.save(role);
  }

  async remove(id: number, userId: string): Promise<{ message: string }> {
    const adminCreateRole: any = await this.adminRepository.findOne({
      where: { id: Number(userId) },
    });
    if (!adminCreateRole || adminCreateRole.isAdmin !== true)
      throw new NotFoundException('Only Admins are Authorized to peform task');
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role id not found');
    }
    await this.roleRepo.remove(role);
    return {
      message: `Role with id ${id} has been successfully deleted`,
    };
  }
  async getStaffByRoleName(roleName: string) {
    const role = await this.roleRepo.findOne({
      where: { name: roleName },
      relations: ['staff'], // load staff attached to role
    });

    if (!role) {
      throw new NotFoundException(`Role "${roleName}" not found`);
    }

    return role.staff;
  }

  async getStaffByRoleId(roleId: number) {
    const role = await this.roleRepo.findOne({
      where: { id: roleId },
      relations: ['staff'],
    });

    if (!role) {
      throw new NotFoundException(`Role with id ${roleId} not found`);
    }

    return role.staff;
  }
}
