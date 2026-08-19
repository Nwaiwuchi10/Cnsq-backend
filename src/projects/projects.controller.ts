import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AssignStaffDto } from './dto/assignedToStaff.dto';
import { AddCommentDto } from './dto/project-comment.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';
import { Project } from './entities/project.entity';
import { StaffOrAdminAuthGuard } from 'src/staff-register/guard/staff-admin-guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';
import * as multerS3 from 'multer-s3';
import { DataSource } from 'typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { v4 as uuidv4 } from 'uuid';
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private dataSource: DataSource,
  ) { }

  @Post()
  // @UseGuards(StaffAuthGuard)
  @UseGuards(StaffOrAdminAuthGuard)
  @UseInterceptors(
    FileInterceptor('apk', {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `projects-pics/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max for profile pics
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body('dto') dto: string,
    // @Body() dto: CreateProjectDto,
    @Req() req,
  ) {
    const userId = req.staffId ?? req.userId;
    const createdto = dto ? JSON.parse(dto) : {};
    // const userId = req.staffId;
    return this.projectsService.create(createdto, userId, file);
  }

  @Get()
  findAll(@Query('departmentId') departmentId?: number) {
    return this.projectsService.findAll(departmentId ? Number(departmentId) : undefined);
  }
  @Get('paginated/all')
  async getAllWithPagination(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: 'newest' | 'oldest',
  ) {
    return this.projectsService.getAllWithPagination(
      Number(page),
      Number(limit),
      search,
      status,
      sort,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.findOne(id);
  }

  @Get('data/:uuid')
  findByUuid(@Param('uuid') uuid: string) {
    return this.projectsService.findByUuid(uuid);
  }
  @Patch(':id')
  @UseGuards(
    StaffOrAdminAuthGuard,
    // PermissionGuard
  )
  @UseInterceptors(
    FileInterceptor('apk', {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `projects-pics/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max for profile pics
    }),
  )
  async updateProject(
    @Param('id', ParseIntPipe) projectId: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('dto') dto: string,
    // @Body() dto: UpdateProjectDto,
    @Req() req,
  ) {
    const userId = req.staffId ?? req.userId;
    const updatedto = dto ? JSON.parse(dto) : {};

    // 🛡️ Manual validation for the parsed DTO
    const updateProjectDto = plainToInstance(UpdateProjectDto, updatedto);
    const errors = await validate(updateProjectDto);
    if (errors.length > 0) {
      throw new BadRequestException(errors);
    }

    return this.projectsService.updateProject(
      projectId,
      updateProjectDto,
      userId,
      file,
    );
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projectsService.remove(id);
  }

  // Assign staff to project (prefer route param; body keeps staffId & role)
  @Post(':id/assign')
  @UseGuards(
    StaffOrAdminAuthGuard,
    // PermissionGuard
  )
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AssignStaffDto,
    @Req() req,
  ) {
    console.log('AssignStaffDto body:', body);
    // const projectId = body.projectId ?? id;
    const userId = req.staffId ?? req.userId;
    return this.projectsService.assignMultipleStaff(
      id,
      body.assignments,
      userId,
    );
  }
  // Add comment to project
  @Patch(':id/add/comments')
  @UseGuards(StaffAuthGuard)
  addComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddCommentDto,
    @Req() req,
  ) {
    const staffId = req.staffId;
    return this.projectsService.addComment(id, staffId, body.text);
  }

  // Fetch a specific user's projects: scope=created|assigned|all (default all)
  @Get('user/:userId')
  getUserProjects(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('scope') scope: 'created' | 'assigned' | 'all' = 'all',
  ) {
    return this.projectsService.getUserProjects(userId, scope);
  }
  @Get('staff/all/:staffId')
  async getProjectsByStaff(@Param('staffId', ParseIntPipe) staffId: number) {
    const projects =
      await this.projectsService.getAllProjectsAssignedToStaff(staffId);
    return { data: projects };
  }
  @Get('all/stats')
  async getProjectStats() {
    return this.projectsService.getProjectStats();
  }

  @Get(':projectId/staffs')
  async getProjectStaffs(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.projectsService.getProjectIdAssignedStaffs(projectId);
  }

  @Post('backfill-uuids/all')
  async backfillUuids() {
    const staffRepo = this.dataSource.getRepository(Staff);
    const projectRepo = this.dataSource.getRepository(Project);

    // Fetch only records missing UUIDs
    const staffWithoutUuid = await staffRepo
      .createQueryBuilder('staff')
      .where('staff.uuid IS NULL')
      .getMany();

    const projectWithoutUuid = await projectRepo
      .createQueryBuilder('project')
      .where('project.uuid IS NULL')
      .getMany();

    // Assign and save new UUIDs
    for (const s of staffWithoutUuid) {
      s.uuid = uuidv4();
      await staffRepo.save(s);
    }

    for (const p of projectWithoutUuid) {
      p.uuid = uuidv4();
      await projectRepo.save(p);
    }

    return {
      staffUpdated: staffWithoutUuid.length,
      projectsUpdated: projectWithoutUuid.length,
      message: 'UUIDs successfully backfilled.',
    };
  }
}
