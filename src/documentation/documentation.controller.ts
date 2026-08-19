import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
  UploadedFiles,
  ParseIntPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { DocumentationService } from './documentation.service';
import { CreateDocumentationDto } from './dto/create-documentation.dto';
import { UpdateDocumentationDto } from './dto/update-documentation.dto';
import { StaffOrAdminAuthGuard } from 'src/staff-register/guard/staff-admin-guard';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';
import * as multerS3 from 'multer-s3';

@Controller('documentation')

export class DocumentationController {
  constructor(private readonly documentationService: DocumentationService) { }

  @Post()
  @UseGuards(StaffOrAdminAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: (req, file, cb) => cb(null, file.mimetype),
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `documentation-files/${Date.now()}-${sanitized}`);
        },
      }),
    }),
  )
  async create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('dto') dtoStr: string,
    @Req() req,
  ) {
    const dto: CreateDocumentationDto = dtoStr ? JSON.parse(dtoStr) : {};
    const userId = req.staffId ?? req.userId;
    const fileUrls = files ? files.map((f: any) => f.location) : [];
    return this.documentationService.create(dto, userId, fileUrls);
  }

  @Get()
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    return this.documentationService.findAll(
      Number(page),
      Number(limit),
      search,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.documentationService.findOne(id);
  }

  @Put(':id')
  @UseGuards(StaffOrAdminAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: (req, file, cb) => cb(null, file.mimetype),
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `documentation-files/${Date.now()}-${sanitized}`);
        },
      }),
    }),
  )
  async updatePut(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('dto') dtoStr: string,
    @Req() req,
  ) {
    return this.update(id, files, dtoStr, req);
  }

  @Patch(':id')
  @UseGuards(StaffOrAdminAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: (req, file, cb) => cb(null, file.mimetype),
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `documentation-files/${Date.now()}-${sanitized}`);
        },
      }),
    }),
  )
  async update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('dto') dtoStr: string,
    @Req() req,
  ) {
    const dto: UpdateDocumentationDto = dtoStr ? JSON.parse(dtoStr) : {};
    const userId = req.staffId ?? req.userId;
    const fileUrls = files ? files.map((f: any) => f.location) : [];
    return this.documentationService.update(id, dto, userId, fileUrls);
  }

  @Delete(':id')
  @UseGuards(StaffOrAdminAuthGuard)
  async remove(@Param('id') id: string, @Req() req) {
    const userId = req.staffId ?? req.userId;
    return this.documentationService.remove(id, userId);
  }
}
