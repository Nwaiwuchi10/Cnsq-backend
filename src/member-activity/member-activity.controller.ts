import {
  Controller,
  Get,
  UseGuards,
  Req,
  Param,
  Query,
} from '@nestjs/common';
import { MemberActivityService } from './member-activity.service';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';

@Controller('member-activity')
export class MemberActivityController {
  constructor(private readonly activityService: MemberActivityService) {}

  @Get()
  @UseGuards(StaffAuthGuard)
  async getActivities(@Req() req: any) {
    // Get activities for the currently authenticated staff member
    const staffId = req.staffId;
    return await this.activityService.findAllByStaff(staffId);
  }

  @Get('all-staff')
  @UseGuards(UserAuthGuard)
  async getAllActivities(@Req() req: any) {
    // Get all staff activities - Only for admins
    return await this.activityService.findAllActivities(req.userId);
  }

  @Get('staff/:staffId')
  @UseGuards(UserAuthGuard)
  async getStaffActivities(
    @Param('staffId') staffId: number,
    @Req() req: any,
  ) {
    // Get activities for a specific staff member - Only for admins (or self)
    return await this.activityService.findAllByStaff(staffId, req.userId);
  }

  @Get('logs/staff-directory')
  @UseGuards(UserAuthGuard)
  async getStaffActivityDirectory(
    @Query('type') type: string,
    @Query('date') date: string,
    @Query('staffId') staffId: number,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('departmentId') departmentId: number,
    @Query('search') search: string,
    @Query('action') action: string,
    @Req() req: any,
  ) {
    return await this.activityService.fetchStaffActivityDirectory(
      req.userId,
      type,
      date,
      staffId ? Number(staffId) : undefined,
      page ? Number(page) : 1,
      limit ? Number(limit) : 100,
      departmentId ? Number(departmentId) : undefined,
      search,
      action,
    );
  }

  @Get('logs/actions')
  @UseGuards(UserAuthGuard)
  async getUniqueActions(@Req() req: any) {
    return await this.activityService.getUniqueActions(req.userId);
  }

  @Get('stats/logins')
  @UseGuards(UserAuthGuard)
  async getLoginStats(
    @Query('type') type: string,
    @Query('date') date: string,
    @Query('staffId') staffId: number,
    @Req() req: any,
  ) {
    return await this.activityService.getLoginStats(
      req.userId,
      type,
      date,
      staffId ? Number(staffId) : undefined,
    );
  }
}
