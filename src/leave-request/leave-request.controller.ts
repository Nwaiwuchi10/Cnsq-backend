import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
  Query,
} from '@nestjs/common';
import { LeaveRequestService } from './leave-request.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { StaffAuthGuard } from '../staff-register/guard/staff.guard';
import { StaffOrAdminAuthGuard } from '../staff-register/guard/staff-admin-guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';
import * as multerS3 from 'multer-s3';

@Controller('leave-request')
export class LeaveRequestController {
  constructor(private readonly leaveRequestService: LeaveRequestService) { }

  @Post()
  @UseGuards(StaffAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `leave-request-files/${Date.now()}-${sanitized}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'image/jpeg',
          'image/png',
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Only PDF, Office documents and images are allowed'), false);
        }
      },
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  async create(
    @Body('dto') dto: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    const staffId = req.staffId;
    const parsedDto: CreateLeaveRequestDto = dto ? JSON.parse(dto) : {};
    return this.leaveRequestService.create(parsedDto, staffId, file);
  }

  @Get('me')
  @UseGuards(StaffAuthGuard)
  findAllForUser(@Req() req, @Query('search') search?: string, @Query('status') status?: string) {
    const staffId = req.staffId;
    return this.leaveRequestService.findAllForUser(staffId, search, status);
  }

  @Get('me/stats')
  @UseGuards(StaffAuthGuard)
  getStats(@Req() req) {
    const staffId = req.staffId;
    return this.leaveRequestService.getStats(staffId);
  }

  @Get(':id')
  @UseGuards(StaffOrAdminAuthGuard)
  findOne(@Param('id') id: string) {
    return this.leaveRequestService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(StaffOrAdminAuthGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateLeaveStatusDto,
    @Req() req,
  ) {
    const adminId = req.staffId ?? req.userId;
    return this.leaveRequestService.updateStatus(id, updateDto, adminId);
  }

  @Get('supervisor/all')
  @UseGuards(StaffAuthGuard)
  findAllForSupervisor(@Req() req, @Query('search') search?: string) {
    const supervisorId = req.staffId;
    return this.leaveRequestService.findAllForSupervisor(supervisorId, search);
  }

  @Get('supervisor/stats')
  @UseGuards(StaffAuthGuard)
  getSupervisorStats(@Req() req) {
    const supervisorId = req.staffId;
    return this.leaveRequestService.getSupervisorStats(supervisorId);
  }

  @Get('supervisor/me')
  @UseGuards(StaffAuthGuard)
  findSupervisorMe(@Req() req, @Query('search') search?: string, @Query('status') status?: string) {
    const staffId = req.staffId;
    return this.leaveRequestService.findSupervisorMe(staffId, search, status);
  }

  @Get('supervisor/check')
  @UseGuards(StaffAuthGuard)
  async isSupervisor(@Req() req) {
    const staffId = req.staffId;
    const result = await this.leaveRequestService.isSupervisor(staffId);
    return { isSupervisor: result };
  }

  @Get('admin/all')
  @UseGuards(StaffOrAdminAuthGuard)
  findAllForAdmin(@Query('search') search?: string) {
    return this.leaveRequestService.findAllForAdmin(search);
  }

  @Patch(':id')
  @UseGuards(StaffAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `leave-request-files/${Date.now()}-${sanitized}`);
        },
      }),
    }),
  )
  async update(
    @Param('id') id: string,
    @Body('dto') dto: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req,
  ) {
    const staffId = req.staffId;
    const parsedDto: Partial<CreateLeaveRequestDto> = dto ? JSON.parse(dto) : {};
    return this.leaveRequestService.update(id, parsedDto, staffId, file);
  }

  @Get('admin/stats')
  @UseGuards(StaffOrAdminAuthGuard)
  getAdminStats() {
    return this.leaveRequestService.getAdminStats();
  }
}
