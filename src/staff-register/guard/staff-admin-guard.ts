// import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
// import { StaffAuthGuard } from './staff.guard';
// import { UserAuthGuard } from 'src/admin/guard/auth.guard';

// @Injectable()
// export class StaffOrAdminAuthGuard implements CanActivate {
//   constructor(
//     private readonly staffAuth: StaffAuthGuard,
//     private readonly userAuth: UserAuthGuard,
//   ) {}

//   async canActivate(context: ExecutionContext): Promise<boolean> {
//     // Try StaffAuthGuard first
//     try {
//       if (await this.staffAuth.canActivate(context)) {
//         return true;
//       }
//     } catch {}

//     // Then try UserAuthGuard
//     try {
//       if (await this.userAuth.canActivate(context)) {
//         return true;
//       }
//     } catch {}

//     return false;
//   }
// }
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { StaffAuthGuard } from './staff.guard';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';

@Injectable()
export class StaffOrAdminAuthGuard implements CanActivate {
  constructor(
    private readonly staffAuth: StaffAuthGuard,
    private readonly userAuth: UserAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();

    // 1️⃣ Try StaffAuthGuard
    try {
      if (await this.staffAuth.canActivate(context)) {
        if (!req.staffId) {
          Logger.error('StaffAuthGuard passed but req.staffId is missing in request object');
          throw new UnauthorizedException('Staff authentication failed: staffId missing');
        }
        Logger.log(`Staff authenticated: staffId=${req.staffId}`);
        return true;
      }
    } catch (e) {
      Logger.warn(`StaffAuthGuard failed for request ${req.method} ${req.url}: ${e.message}`);
    }

    // 2️⃣ Try UserAuthGuard
    try {
      if (await this.userAuth.canActivate(context)) {
        if (!req.userId) {
          Logger.error('UserAuthGuard passed but req.userId is missing in request object');
          throw new UnauthorizedException('Admin authentication failed: userId missing');
        }
        Logger.log(`Admin authenticated: userId=${req.userId}`);
        return true;
      }
    } catch (e) {
      Logger.warn(`UserAuthGuard failed for request ${req.method} ${req.url}: ${e.message}`);
    }

    // 3️⃣ If neither passed, deny
    throw new UnauthorizedException('Not authorized as staff or admin');
  }
}
