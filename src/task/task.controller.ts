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
  BadRequestException,
  UseInterceptors,
  UploadedFile,
  Headers,
  Query,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';
import { AddCommentDto, EditCommentDto } from './dto/task-comments.dto';
import { Task } from './entities/task.entity';
import { BulkUploadDto } from './dto/bulk-upload.dto';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';
import * as multerS3 from 'multer-s3';
import * as multer from 'multer';
import * as path from 'path';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('task')
export class TaskController {
  constructor(private readonly taskService: TaskService) { }

  @Post()
  @UseGuards(StaffAuthGuard)
  create(@Body() dto: CreateTaskDto, @Req() req) {
    const staffId = req.staffId;
    return this.taskService.create(dto, staffId);
  }

  @Get()
  findAll(
    @Query('projectId') projectId?: number,
    @Query('departmentId') departmentId?: number
  ) {
    return this.taskService.findAll(
      projectId ? Number(projectId) : undefined,
      departmentId ? Number(departmentId) : undefined
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.taskService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(StaffAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @Req() req) {
    const staffId = req.staffId;
    return this.taskService.update(+id, dto, staffId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.taskService.remove(+id);
  }

  // Dashboard: full task analytics for a staff member (powers the "View Task" modal)
  @Get('staff/:staffId/dashboard')
  getStaffTaskDashboard(@Param('staffId', ParseIntPipe) staffId: number) {
    return this.taskService.getStaffTaskDashboard(staffId);
  }

  // Enhanced endpoint with pagination and search for active, completed, and open tasks
  @Get('staff/:staffId/tasks-by-status')
  getStaffTasksByStatusWithPagination(
    @Param('staffId', ParseIntPipe) staffId: number,
    @Query('activePageNum') activePageNum: number = 1,
    @Query('activePageSize') activePageSize: number = 10,
    @Query('activeSearch') activeSearch: string = '',
    @Query('completedPageNum') completedPageNum: number = 1,
    @Query('completedPageSize') completedPageSize: number = 10,
    @Query('completedSearch') completedSearch: string = '',
    @Query('openPageNum') openPageNum: number = 1,
    @Query('openPageSize') openPageSize: number = 10,
    @Query('openSearch') openSearch: string = '',
  ) {
    return this.taskService.getStaffTasksByStatusWithPagination(
      staffId,
      activePageNum,
      activePageSize,
      activeSearch,
      completedPageNum,
      completedPageSize,
      completedSearch,
      openPageNum,
      openPageSize,
      openSearch,
    );
  }

  // Extra: all tasks for a staff
  @Get('staff/:staffId')
  findByStaff(@Param('staffId') staffId: string) {
    return this.taskService.findByStaff(+staffId);
  }

  @Patch(':id/comments')
  @UseGuards(StaffAuthGuard)
  addComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddCommentDto,
    @Req() req,
  ) {
    const staffId = req.staffId; // from JWT
    return this.taskService.addComment(id, staffId, body);
  }

  @Get('all/sprints')
  async getAllSprints() {
    return this.taskService.getAllSprints();
  }

  @Get('staff/:staffId/project/:projectId/t')
  async getStaffTasksByProjects(
    @Param('staffId', ParseIntPipe) staffId: number,
    @Param('projectId', ParseIntPipe) projectId: number,
  ): Promise<Task[]> {
    return this.taskService.getStaffTasksByProject(staffId, projectId);
  }

  @Get('project/:projectId')
  findByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('day') day?: number,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('urgency') urgency?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ): Promise<any> {
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 50;
    return this.taskService.findByProjectWithDateFilter(
      projectId,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
      day ? Number(day) : undefined,
      status,
      priority,
      urgency,
      pageNum,
      limitNum,
      search,
    );
  }

  @Get('department/:departmentId')
  findByDepartment(
    @Param('departmentId', ParseIntPipe) departmentId: number,
    @Query('sprint') sprint?: number,
    @Query('staffId') staffId?: number,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('urgency') urgency?: string,
    @Query('projectId') projectId?: number,
  ): Promise<Task[]> {
    return this.taskService.findByDepartment(
      departmentId,
      sprint ? Number(sprint) : undefined,
      staffId ? Number(staffId) : undefined,
      status,
      priority,
      urgency,
      projectId ? Number(projectId) : undefined,
    );
  }

  @Get('login/staff')
  @UseGuards(StaffAuthGuard)
  async findByLoginStaffTask(
    @Req() req,
    @Query('sprint') sprint?: number,
    @Query('staffId') queryStaffId?: any,
    @Query('status') status?: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('day') day?: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('priority') priority?: string,
    @Query('urgency') urgency?: string,
    @Query('departmentId') departmentId?: number,
    @Query('projectId') projectId?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ): Promise<any> {
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 50;

    return this.taskService.findByLoginStaffTask(
      sprint ? Number(sprint) : undefined,
      queryStaffId,
      status,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
      day ? Number(day) : undefined,
      startDate,
      endDate,
      priority,
      urgency,
      departmentId ? Number(departmentId) : undefined,
      pageNum,
      limitNum,
      req.staffId,
      search,
      projectId ? Number(projectId) : undefined,
    );
  }

  @Get('staff/:staffId/project/:projectId')
  getStaffTasksByProject(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Param('staffId', ParseIntPipe) staffId: number,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('day') day?: number,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('urgency') urgency?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ): Promise<any> {
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 50;
    return this.taskService.getStaffTasksByProject(
      staffId,
      projectId,
      {
        year: year ? Number(year) : undefined,
        month: month ? Number(month) : undefined,
        day: day ? Number(day) : undefined,
        status,
        priority,
        urgency,
      },
      pageNum,
      limitNum,
      search,
    );
  }

  @Patch(':commentId/comments/edit')
  @UseGuards(StaffAuthGuard)
  async editComment(
    @Param('commentId', ParseIntPipe) commentId: number,

    @Body() dto: EditCommentDto,
    @Req() req,
  ) {
    const staffId = req.staffId;
    return this.taskService.editComment(commentId, staffId, dto);
  }

  @Delete(':commentId/comments/delete')
  @UseGuards(StaffAuthGuard)
  async deleteComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Req() req,
  ) {
    const staffId = req.staffId;
    return this.taskService.deleteComment(commentId, staffId);
  }

  @Patch(':commentId/comments/attach-file')
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
          cb(null, `projects-pics/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max for profile pics
    }),
  )
  async attachFile(
    @Param('commentId') commentId: number,
    @Body('dto') dto: string,
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const staffId = req.staffId;
    const Updatedto = dto ? JSON.parse(dto) : {};
    return this.taskService.attachFileToComment(
      commentId,
      staffId,
      Updatedto.text,
      file,
    );
  }

  @Get('timeline/staff')
  @UseGuards(StaffAuthGuard)
  async getStaffTaskTimeline(@Req() req) {
    const staffId = req.staffId;
    return this.taskService.getStaffTaskTimeline(staffId);
  }

  @Delete(':id/task')
  @UseGuards(StaffAuthGuard)
  deleteTask(@Param('id') id: number, @Req() req) {
    const staffId = req.staffId;
    return this.taskService.deleteTask(id, staffId);
  }

  @Get('projects/:projectId/staff/:staffId/tasks/by-date')
  getStaffTasksByProjectAndDate(
    @Param('projectId') projectId: number,
    @Param('staffId') staffId: number,
    @Query('year') year?: number,
    @Query('month') month?: number,
    @Query('day') day?: number,
  ) {
    return this.taskService.getStaffTasksByProjectAndDate(
      +projectId,
      +staffId,
      year ? +year : undefined,
      month ? +month : undefined,
      day ? +day : undefined,
    );
  }
  @Get('staff/:id/completion-level')
  getStaffCompletionLevel(@Param('id') id: number) {
    return this.taskService.getStaffCompletionLevel(Number(id));
  }
}
