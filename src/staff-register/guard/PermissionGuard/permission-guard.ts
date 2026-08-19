// // src/auth/guards/permission.guard.ts
// import {
//   CanActivate,
//   ExecutionContext,
//   ForbiddenException,
//   Injectable,
// } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
// import { PERMISSIONS_KEY } from './permission-decorator';

import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Repository } from 'typeorm';
import { PERMISSIONS_KEY } from './permission-decorator';
import { ROLES_KEY } from './roles-decorator';

// @Injectable()
// export class PermissionGuard implements CanActivate {
//   constructor(private reflector: Reflector) {}

//   canActivate(context: ExecutionContext): boolean {
//     const requiredPermissions =
//       this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
//         context.getHandler(),
//         context.getClass(),
//       ]) || [];

//     if (!requiredPermissions.length) return true;

//     const request = context.switchToHttp().getRequest();
//     const staff = request.staffId; // comes from StaffAuthGuard (decoded JWT)
//     //   const payload = this.jwtService.verify(token);
//     //   request.staffId = payload.staffId;

//     if (!staff?.roles)
//       throw new ForbiddenException('No roles assigned to this user or staff');

//     const userPermissions = staff.roles.flatMap((role) =>
//       role.permissions.map((p) => p.action),
//     );

//     const hasPermission = requiredPermissions.every((perm) =>
//       userPermissions.includes(perm),
//     );

//     if (!hasPermission)
//       throw new ForbiddenException(
//         'You do not have the required permission for this action',
//       );

//     return true;
//   }
// }
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(Staff)
    private staffRepo: Repository<Staff>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    const requiredRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    const request = context.switchToHttp().getRequest();
    const staffId = request.staffId;

    if (!staffId) throw new BadRequestException('Staff not authenticated');

    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
      relations: ['roles', 'roles.permissions'],
    });

    if (!staff?.roles?.length) {
      throw new BadRequestException('No roles assigned');
    }

    // === Check roles
    if (
      requiredRoles.length &&
      !staff.roles.some((role) => requiredRoles.includes(role.name))
    ) {
      throw new BadRequestException(
        'Your role is not allowed to perform this action',
      );
    }

    // === Check permissions
    const userPermissions = staff.roles.flatMap((role) =>
      role.permissions.map((p) => p.action),
    );

    const hasPermission = requiredPermissions.every((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasPermission) {
      throw new BadRequestException('You lack required permission');
    }

    return true;
  }
}
