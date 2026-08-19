import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { StaffRegisterService } from './staff-register.service';
import {
  CreateStaffRegisterDto,
  StaffRegisterDto,
} from './dto/create-staff-register.dto';
import { UpdateStaffRegisterDto } from './dto/update-staff-register.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';
import * as multerS3 from 'multer-s3';
import { StaffBirthdayDto } from './dto/staffs-birthday.dto';
import {
  StaffAnniversaryDto,
  StaffRecentAnniversaryDto,
} from './dto/staff-anniversary.dto';
import { StaffLoginDto } from './dto/login.dto';
import { StaffAuthGuard } from './guard/staff.guard';
import { Staff } from './entities/staff-register.entity';
import { AssignRoleDto } from './dto/assign-roles.dto';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';
import { PermissionGuard } from './guard/PermissionGuard/permission-guard';
import { RequirePermissions } from './guard/PermissionGuard/permission-decorator';
import { RequireRoles } from './guard/PermissionGuard/roles-decorator';
import { UpdateStaffDto } from './dto/Update-staff-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { StaffOrAdminAuthGuard } from './guard/staff-admin-guard';
import { PaginatedResult } from './dto/paginated-data.dto';
@Controller('staff-register')
export class StaffRegisterController {
  constructor(private readonly staffRegisterService: StaffRegisterService) { }

  @Post()
  @UseGuards(StaffOrAdminAuthGuard)
  // @RequireRoles('Hiring Manager')
  // @RequirePermissions('Post')
  @UseInterceptors(
    FileInterceptor('imgFile', {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `user-profile-pics/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max for profile pics
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body('dto') dto: string,
    @Req() req,
  ) {
    // const userId = req.userId;
    const userId = req.staffId ?? req.userId;
    if (!userId || isNaN(Number(userId))) {
      throw new BadRequestException('Invalid or missing userId');
    }
    const parsedDto = dto ? JSON.parse(dto) : {};

    return this.staffRegisterService.create(parsedDto, userId, file);
  }
  /////roles and permission integration
  @Post('post')
  @UseGuards(StaffAuthGuard, PermissionGuard)
  @RequireRoles('Hiring Manager')
  @RequirePermissions('can_create')
  @UseInterceptors(
    FileInterceptor('imgFile', {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `user-profile-pics/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 100 * 1024 * 1024 }, // 5MB max for profile pics
    }),
  )
  async creates(
    @UploadedFile() file: Express.Multer.File,
    @Body('dto') dto: string,
    @Req() req,
  ) {
    const userId = req.staffId;
    const parsedDto = dto ? JSON.parse(dto) : {};

    return this.staffRegisterService.create(parsedDto, userId, file);
  }
  @Post('login')
  login(@Body() dto: StaffLoginDto, @Req() req) {
    return this.staffRegisterService.loginStaff(dto, req);
  }

  @Post('logout')
  @UseGuards(StaffAuthGuard)
  logout(@Req() req) {
    const userId = req.staffId;
    return this.staffRegisterService.logoutStaff(userId, req);
  }

  // create(@Body() dto: StaffRegisterDto) {
  //   return this.staffRegisterService.create(dto);
  // }

  @Get()
  findAll() {
    return this.staffRegisterService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.staffRegisterService.findOne(+id);
  }

  @Get('data/:uuid')
  findByUuid(@Param('uuid') uuid: string) {
    return this.staffRegisterService.findStaffByuuid(uuid);
  }

  @Get('staff/viewProfile')
  @UseGuards(StaffAuthGuard)
  findStaff(@Req() req) {
    const userId = req.staffId;
    return this.staffRegisterService.FindStaff(userId);
  }

  @Patch(':id/update-profile')
  // @UseGuards(StaffAuthGuard)
  @UseInterceptors(
    FileInterceptor('imgFile', {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `user-profile-pics/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 100 * 1024 * 1024 },
    }),
  )
  async updateProfile(
    @UploadedFile() file: Express.Multer.File,
    @Param('id', ParseIntPipe) id: number,
    @Body('dto') dto: string,
    @Req() req,
  ) {
    const parsedDto = dto ? JSON.parse(dto) : {};
    return this.staffRegisterService.updateProfile(id, parsedDto, file, req);
  }

  // Change Password
  // @UseGuards(StaffAuthGuard)
  @Patch(':id/change-password')
  async changePassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangePasswordDto,
    @Req() req,
  ) {
    return this.staffRegisterService.changePassword(id, dto, req);
  }
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.staffRegisterService.remove(+id);
  }

  // 1) Paginated Staff

  @Get('all/staffs/dept')
  async getAllStaffswithDepartment(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(2), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('department') department?: string,
    @Query('role') role?: string,
    @Query('location') location?: string,
    @Query('completionRange') completionRange?: string, // '0-25' | '26-50' | '51-75' | '76-100'
    @Query('projectId') projectId?: number,
  ) {
    return this.staffRegisterService.getAllStaffswithDepartmentswithTaskcompletion(
      page,
      limit,
      search,
      department,
      role,
      location,
      completionRange,
      projectId ? Number(projectId) : undefined,
    );
  }

  // New-hire endpoint — staff hired within the last N days (default 90)
  @Get('all/staffs/new-hires')
  async getNewHireStaffs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
    @Query('days', new DefaultValuePipe(90), ParseIntPipe) days: number,
    @Query('search') search?: string,
  ) {
    return this.staffRegisterService.getNewHireStaffs(page, limit, days, search);
  }
  @Get('all/staffs')
  async getAllStaffs(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.staffRegisterService.getAllStaffs(page, limit);
  }

  // 2) Birthdays
  @Get('birthdays/today')
  getTodayBirthdays() {
    return this.staffRegisterService.getTodayBirthdays();
  }

  @Get('birthdays/week')
  getThisWeekBirthdays() {
    return this.staffRegisterService.getThisWeekBirthdays();
  }

  @Get('birthdays/month')
  getThisMonthBirthdays() {
    return this.staffRegisterService.getThisMonthBirthdays();
  }

  @Get('birthdays/all')
  getAllBirthdayCelebrants() {
    return this.staffRegisterService.getAllBirthdayCelebrants();
  }

  // 3) Anniversaries
  @Get('anniversaries/yearly')
  getYearlyAnniversaries() {
    return this.staffRegisterService.getYearlyAnniversaries();
  }

  @Get('anniversaries/quarterly')
  getQuarterlyAnniversaries() {
    return this.staffRegisterService.getQuarterlyAnniversaries();
  }

  @Get('anniversaries/all')
  getAllAnniversaries() {
    return this.staffRegisterService.getAllAnniversaries();
  }

  @Get('stats/dashboard')
  async getStats() {
    return this.staffRegisterService.getStats();
  }

  @Get('birthdays/all/upcoming')
  async getUpcomingBirthdays(
    @Query('page') page = 1,
    @Query('limit') limit = 4,
  ): Promise<{
    data: StaffBirthdayDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.staffRegisterService.getUpcomingBirthdays(
      Number(page),
      Number(limit),
    );
  }

  @Get('anniversaries/all/upcoming')
  async getUpcomingAnniversaries(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<PaginatedResult<StaffAnniversaryDto>> {
    return this.staffRegisterService.getUpcomingAnniversaries(+page, +limit);
  }

  @Get('anniversaries/all/recent')
  async getRecentAnniversaries(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<PaginatedResult<StaffRecentAnniversaryDto>> {
    return this.staffRegisterService.getRecentAnniversaries(+page, +limit);
  }
  @Get('birthdays/today')
  async getTodaysBirthdays(): Promise<Staff[]> {
    return this.staffRegisterService.findTodaysBirthdays();
  }
  @Get('anniversaries/today')
  async getTodaysAnniversaries(): Promise<Staff[]> {
    return this.staffRegisterService.findTodaysAnniversary();
  }
  @Get('anniversaries/month')
  async findThisMonthAnniversary(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ): Promise<PaginatedResult<any>> {
    return this.staffRegisterService.findThisMonthAnniversary(+page, +limit);
  }
  // @Get('anniversaries/month')
  // async getThisMonthAnniversaries(): Promise<Staff[]> {
  //   return this.staffRegisterService.findThisMonthAnniversary();
  // }

  @Patch(':id/assign-roles')
  @UseGuards(UserAuthGuard)
  assignRoles(
    @Param('id') staffId: string,
    @Body() dto: AssignRoleDto,
    @Req() req,
  ) {
    const userId = req.userId;

    return this.staffRegisterService.assignRoles(+staffId, dto, userId);
  }

  @Delete(':staffId/roles/:roleId')
  @UseGuards(UserAuthGuard)
  async removeRole(
    @Param('staffId') staffId: number,
    @Param('roleId') roleId: number,
    @Req() req,
  ) {
    const userId = req.userId;
    return this.staffRegisterService.removeRole(staffId, roleId, userId);
  }

  @Delete(':staffId/roles/project-manager')
  @UseGuards(UserAuthGuard)
  async removeProjectManagerRole(
    @Param('staffId') staffId: number,
    @Req() req,
  ) {
    const userId = req.userId;
    return this.staffRegisterService.removeProjectManagerRole(staffId, userId);
  }

  @Delete(':staffId/roles/hr')
  @UseGuards(UserAuthGuard)
  async removeHrRole(
    @Param('staffId') staffId: number,
    @Req() req,
  ) {
    const userId = req.userId;
    return this.staffRegisterService.removeHrRole(staffId, userId);
  }

  @Get('all/staffs/by-department')
  async getStaffByDepartmentOrRoleOrJobTitle(@Query('name') name: string) {
    return this.staffRegisterService.getStaffByDepartmentOrRoleOrJobTitle(name);
  }

  @Post('populate-uuid')
  async populateUuid() {
    return this.staffRegisterService.populateMissingUuids();
  }

  @Post('forgot-password')
  forgotPassword(@Body('email') email: string, @Req() req) {
    return this.staffRegisterService.forgotPassword(email, req);
  }
  @Post('reset-password')
  resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
    @Req() req,
  ) {
    return this.staffRegisterService.resetPassword(token, newPassword, req);
  }

  @Get('verify-registration-token')
  verifyRegistrationToken(@Query('token') token: string) {
    return this.staffRegisterService.verifyRegistrationToken(token);
  }

  @Post('complete-registration')
  completeRegistration(
    @Body() body: { token: string; oldPassword?: string; newPassword?: string; confirmPassword?: string },
    @Req() req,
  ) {
    return this.staffRegisterService.completeRegistration(body, req);
  }

  @Delete(':id/soft-delete')
  @UseGuards(StaffOrAdminAuthGuard)
  async softDelete(@Param('id', ParseIntPipe) id: number, @Req() req) {
    const userId = req.staffId ?? req.userId;
    await this.staffRegisterService.softDeleteStaff(id, userId);
    return {
      message: 'Staff soft-deleted successfully',
    };
  }

  // Restore staff
  @Patch(':id/restore')
  @UseGuards(StaffOrAdminAuthGuard)
  async restore(@Param('id', ParseIntPipe) id: number, @Req() req) {
    const userId = req.userId;
    await this.staffRegisterService.restoreStaff(id, userId);
    return {
      message: 'Staff account restored successfully',
    };
  }

  @Get('deleted/staff')
  async getDeletedStaff(): Promise<Staff[]> {
    return this.staffRegisterService.findDeletedStaff();
  }
}
