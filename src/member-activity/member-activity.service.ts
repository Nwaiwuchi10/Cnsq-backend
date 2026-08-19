// Member Activity Service
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemberActivity } from './entities/member-activity.entity';
import { Request } from 'express';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { Admin } from '../admin/entities/admin.entity';
import * as dayjs from 'dayjs';

@Injectable()
export class MemberActivityService {
  constructor(
    @InjectRepository(MemberActivity)
    private readonly activityRepo: Repository<MemberActivity>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,
  ) { }

  async logActivity(
    staffId: number,
    action: string,
    status: string = 'Success',
    req?: Request,
    referenceId?: string,
  ) {
    let deviceType = 'Unknown';
    let browser = 'Unknown';
    let ipAddress = 'Unknown';
    let location = 'Lagos, Nigeria'; // Default

    // Fetch staff info for IP and Location
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
      relations: ['address'],
    });

    if (staff) {
      if (staff.lastIpAddress) ipAddress = staff.lastIpAddress;
      if (staff.address) {
        location = `${staff.address.city}, ${staff.address.state}`;
      }
    }

    if (req) {
      const ua = req.headers['user-agent'] || '';
      ipAddress =
        (req.headers['x-forwarded-for'] as string) ||
        req.socket.remoteAddress ||
        'Unknown';

      // Very basic manual parsing since npm install failed
      if (ua.includes('Mobi') || ua.includes('Android')) {
        deviceType = 'Mobile';
      } else {
        deviceType = 'Desktop';
      }

      if (ua.includes('Chrome')) browser = 'Chrome';
      else if (ua.includes('Firefox')) browser = 'Firefox';
      else if (ua.includes('Safari')) browser = 'Safari';
      else if (ua.includes('Edge')) browser = 'Edge';

      // Add OS context if possible - check mobile first as they often contain "Linux" or "Safari"
      if (ua.includes('Android')) browser += ' on Android';
      else if (ua.includes('iPhone') || ua.includes('iPad'))
        browser += ' on iOS';
      else if (ua.includes('Windows')) browser += ' on Windows';
      else if (ua.includes('Mac OS')) browser += ' on macOS';
      else if (ua.includes('Linux')) browser += ' on Linux';
    }

    let sessionDuration: string | null = null;
    if (action === 'Staff Logged Out' || action === 'Session Timed Out') {
      const lastLogin = await this.activityRepo.findOne({
        where: { staffId, action: 'Staff Logged In' },
        order: { createdAt: 'DESC' },
      });

      if (lastLogin && lastLogin.createdAt) {
        const loginTime = dayjs(lastLogin.createdAt);
        const logoutTime = dayjs();
        const diffMs = logoutTime.diff(loginTime);

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        sessionDuration = `${hours.toString().padStart(2, '0')}h ${minutes
          .toString()
          .padStart(2, '0')}m`;
      }
    }

    const activity = new MemberActivity();
    activity.staffId = staffId;
    activity.action = action;
    activity.status = status;
    activity.deviceType = deviceType;
    activity.browser = browser;
    activity.ipAddress = ipAddress;
    activity.location = location;
    activity.sessionDuration = sessionDuration;
    activity.referenceId = referenceId || null;

    return await this.activityRepo.save(activity);
  }

  async findAllByStaff(staffId: number, requesterId?: number) {
    // If requesterId is provided, check if it's the same as staffId or if requester is an admin
    if (requesterId && staffId !== requesterId) {
      const admin = await this.adminRepo.findOne({ where: { id: requesterId } });
      if (!admin || !admin.isAdmin) {
        throw new UnauthorizedException(
          'You are not authorized to view this staff member\'s activities',
        );
      }
    }

    return await this.activityRepo.find({
      where: { staffId },
      relations: ['staff'],
      order: { createdAt: 'DESC' },
      take: 100, // Increased limit for detailed view
    });
  }

  async findAllActivities(adminId: number) {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin || !admin.isAdmin) {
      throw new UnauthorizedException(
        'Only admins are authorized to view all staff activities',
      );
    }

    return await this.activityRepo.find({
      relations: ['staff'],
      order: { createdAt: 'DESC' },
    });
  }

  async getActivityStats(staffId?: number) {
    const query = this.activityRepo.createQueryBuilder('activity');

    if (staffId) {
      query.where('activity.staffId = :staffId', { staffId });
    }

    const total = await query.getCount();
    const successCount = await query
      .andWhere('activity.status = :status', { status: 'Success' })
      .getCount();
    const failedCount = total - successCount;

    return {
      total,
      success: successCount,
      failed: failedCount,
    };
  }

  async fetchStaffActivityDirectory(
    adminId: number,
    type: string = 'daily',
    date?: string,
    staffId?: number,
    page: number = 1,
    limit: number = 100,
    departmentId?: number,
    search?: string,
    action?: string,
  ) {
    // Admin Authorization Check
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin || !admin.isAdmin) {
      throw new UnauthorizedException(
        'Only admins are authorized to access the staff activity directory',
      );
    }

    const typeMap: Record<string, string> = {
      daily: 'day',
      weekly: 'week',
      monthly: 'month',
      yearly: 'year',
    };
    const unit = typeMap[type] || 'day';

    const referenceDate = date ? dayjs(date) : dayjs();
    const startDate = referenceDate.startOf(unit as any).toDate();
    const endDate = referenceDate.endOf(unit as any).toDate();

    const query = this.activityRepo
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.staff', 'staff')
      .leftJoinAndSelect('staff.employment', 'employment')
      .leftJoinAndSelect('employment.department', 'department')
      .leftJoinAndSelect('employment.departmentalRole', 'departmentalRole')
      .where('activity.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .orderBy('activity.createdAt', 'DESC');

    if (staffId) {
      query.andWhere('activity.staffId = :staffId', { staffId });
    }

    if (departmentId) {
      query.andWhere('department.id = :departmentId', { departmentId });
    }

    if (action && action !== 'All') {
      query.andWhere('activity.action = :action', { action });
    }

    if (search) {
      query.andWhere(
        '(LOWER(staff.firstName) LIKE :search OR LOWER(staff.lastName) LIKE :search OR LOWER(activity.action) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    const [data, total] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUniqueActions(adminId: number) {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin || !admin.isAdmin) {
      throw new UnauthorizedException(
        'Only admins are authorized to access action logs',
      );
    }
    const result = await this.activityRepo
      .createQueryBuilder('activity')
      .select('DISTINCT(activity.action)', 'action')
      .orderBy('action', 'ASC')
      .getRawMany();
    return result.map((r) => r.action).filter(Boolean);
  }

  async getLoginStats(
    adminId: number,
    type: string = 'daily',
    date?: string,
    staffId?: number,
  ) {
    // Admin Authorization Check
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin || !admin.isAdmin) {
      throw new UnauthorizedException(
        'Only admins are authorized to access usage analytics',
      );
    }

    const typeMap: Record<string, string> = {
      daily: 'day',
      weekly: 'week',
      monthly: 'month',
      yearly: 'year',
    };
    const unit = typeMap[type] || 'day';

    const referenceDate = date ? dayjs(date) : dayjs();
    const startDate = referenceDate.startOf(unit as any).toDate();
    const endDate = referenceDate.endOf(unit as any).toDate();

    const query = this.activityRepo
      .createQueryBuilder('activity')
      .where('activity.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .andWhere('activity.action IN (:...actions)', {
        actions: [
          'Staff Logged In',
          'Login attempt failed',
          'Staff Logged Out',
          'Session Timed Out',
        ],
      });

    if (staffId) {
      query.andWhere('activity.staffId = :staffId', { staffId });
    }

    const activities = await query.getMany();

    const stats = {
      totalLogins: activities.filter((a) => a.action === 'Staff Logged In').length,
      failedAttempts: activities.filter((a) => a.action === 'Login attempt failed')
        .length,
      totalLogouts: activities.filter(
        (a) =>
          a.action === 'Staff Logged Out' || a.action === 'Session Timed Out',
      ).length,
      uniqueStaffCount: new Set(activities.map((a) => a.staffId)).size,
      deviceDistribution: this.calculateDistribution(activities, 'deviceType'),
      browserDistribution: this.calculateDistribution(activities, 'browser'),
      locationDistribution: this.calculateDistribution(activities, 'location'),
      activityTrends: this.calculateTrends(activities, unit),
    };

    return stats;
  }

  private calculateDistribution(data: any[], key: string) {
    const dist: Record<string, number> = {};
    data.forEach((item) => {
      const val = String(item[key] || 'Unknown');
      dist[val] = (dist[val] || 0) + 1;
    });
    return dist;
  }

  private calculateTrends(activities: MemberActivity[], unit: string) {
    const trends: Record<string, number> = {};
    activities.forEach((act) => {
      let bucket: string;
      const date = dayjs(act.createdAt);
      if (unit === 'day') {
        bucket = date.format('HH:00'); // Hour by hour for daily
      } else if (unit === 'week' || unit === 'month') {
        bucket = date.format('YYYY-MM-DD'); // Day by day
      } else {
        bucket = date.format('YYYY-MM'); // Month by month for yearly
      }
      trends[bucket] = (trends[bucket] || 0) + 1;
    });
    return trends;
  }
}
