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
import { Observable } from 'rxjs';
import { Request } from 'express';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(MemberActivity)
    private readonly activityRepo: Repository<MemberActivity>,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Invalid token');
    }

    try {
      const payload = this.jwtService.verify(token);
      request.staffId = payload.staffId;
    } catch (e) {
      if (e.name === 'TokenExpiredError') {
        const decoded = this.jwtService.decode(token) as any;
        if (decoded && decoded.staffId) {
          const activity = new MemberActivity();
          activity.staffId = decoded.staffId;
          activity.action = 'Session Timed Out';
          activity.status = 'Expired';
          activity.ipAddress = request.ip || request.socket.remoteAddress || 'Unknown';

          // Calculate duration if possible (optional refinement)
          const lastLogin = await this.activityRepo.findOne({
            where: { staffId: decoded.staffId, action: 'Staff Logged In' },
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
      Logger.error(e.message);
      throw new UnauthorizedException('Invalid Token');
    }
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    return request.headers.authorization?.split(' ')[1];
  }
}
