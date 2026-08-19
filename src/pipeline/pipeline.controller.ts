import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as multerS3 from 'multer-s3';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';
import { PipelineService } from './pipeline.service';
import { CreatePipelineIdeaDto } from './dto/create-pipeline-idea.dto';
import { CreatePipelineCommentDto } from './dto/create-pipeline-comment.dto';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';


@Controller('pipeline')
@UseGuards(StaffAuthGuard)
export class PipelineController {
  constructor(private readonly pipelineService: PipelineService) { }

  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname.replace(/\s+/g, '').replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `pipeline/ideas/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  create(
    @Req() req: any, 
    @Body('dto') dtoString: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    const userId = req.staffId || (req.user && req.user.id);
    const dto: CreatePipelineIdeaDto = dtoString ? JSON.parse(dtoString) : {};
    if (files && files.length > 0) {
      dto.attachments = files.map((f: any) => f.location);
    }
    return this.pipelineService.createIdea(userId, dto);
  }

  @Get()
  findAll(
    @Query('search') search: string,
    @Query('departmentId') departmentId: string,
    @Query('limit') limit = 10,
    @Query('offset') offset = 0
  ) {
    return this.pipelineService.findAllIdeas(search, departmentId, +limit, +offset);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pipelineService.findOneIdea(id);
  }

  @Patch(':id')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname.replace(/\s+/g, '').replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `pipeline/ideas/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  update(
    @Req() req: any, 
    @Param('id') id: string, 
    @Body('dto') dtoString: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    const userId = req.staffId || (req.user && req.user.id);
    const dto: Partial<CreatePipelineIdeaDto> = dtoString ? JSON.parse(dtoString) : {};
    if (files && files.length > 0) {
      dto.attachments = files.map((f: any) => f.location);
    }
    return this.pipelineService.updateIdea(id, userId, dto);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    const userId = req.staffId || (req.user && req.user.id);
    return this.pipelineService.deleteIdea(id, userId);
  }

  @Post(':id/react')
  reactToIdea(@Req() req: any, @Param('id') id: string, @Body('emoji') emoji: string) {
    const userId = req.staffId || (req.user && req.user.id);
    return this.pipelineService.reactToIdea(id, userId, emoji);
  }

  @Post(':id/comments')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname.replace(/\s+/g, '').replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `pipeline/comments/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  addComment(
    @Req() req: any, 
    @Param('id') id: string, 
    @Body('dto') dtoString: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    const userId = req.staffId || (req.user && req.user.id);
    const dto: CreatePipelineCommentDto = dtoString ? JSON.parse(dtoString) : {};
    if (files && files.length > 0) {
      dto.attachments = files.map((f: any) => f.location);
    }
    return this.pipelineService.addComment(id, userId, dto);
  }

  @Post('comments/:commentId/react')
  reactToComment(@Req() req: any, @Param('commentId') commentId: string, @Body('emoji') emoji: string) {
    const userId = req.staffId || (req.user && req.user.id);
    return this.pipelineService.reactToComment(commentId, userId, emoji);
  }
}
