import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberActivity } from '../../member-activity/entities/member-activity.entity';
import { Admin } from '../entities/admin.entity';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(MemberActivity)
    private readonly activityRepo: Repository<MemberActivity>,
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Invalid token');
    }

    try {
      const payload = this.jwtService.verify(token);
      request.userId = payload.userId;

      // Verify if the user is actually an admin
      const admin = await this.adminRepo.findOne({
        where: { id: payload.userId, isAdmin: true },
      });

      if (!admin) {
        throw new UnauthorizedException('Only Admins are authorized for this action');
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      if (e.name === 'TokenExpiredError') {
        const decoded = this.jwtService.decode(token) as any;
        if (decoded && decoded.userId) {
          const admin = await this.adminRepo.findOne({
            where: { id: decoded.userId },
            relations: ['staff'],
          });

          if (admin && admin.staff) {
            const activity = new MemberActivity();
            activity.staffId = admin.staff.id;
            activity.action = 'Session Timed Out';
            activity.status = 'Expired';
            activity.ipAddress = request.ip || request.socket.remoteAddress || 'Unknown';

            const lastLogin = await this.activityRepo.findOne({
              where: { staffId: admin.staff.id, action: 'Staff Logged In' },
              order: { createdAt: 'DESC' },
            });

            if (lastLogin && lastLogin.createdAt) {
              const loginTime = new Date(lastLogin.createdAt).getTime();
              const now = new Date().getTime();
              const diffMs = now - loginTime;
              const hours = Math.floor(diffMs / (1000 * 60 * 60));
              const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
              activity.sessionDuration = `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m`;
            }

            await this.activityRepo.save(activity);
          }
        }
      }
      Logger.error(e.message);
      throw new UnauthorizedException('Invalid Token');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    return request.headers.authorization?.split(' ')[1];
  }
}
