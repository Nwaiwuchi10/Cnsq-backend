import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CeoMessagingCenterService } from './ceo-messaging-center.service';
import { CreateCeoMessagingCenterDto } from './dto/create-ceo-messaging-center.dto';
import { UpdateCeoMessagingCenterDto } from './dto/update-ceo-messaging-center.dto';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';
import * as multerS3 from 'multer-s3';

@Controller('ceo-messaging-center')
export class CeoMessagingCenterController {
  constructor(private readonly messageService: CeoMessagingCenterService) {}

  @Post()
  @UseGuards(StaffAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `ceo-broadcasts/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max per file
    }),
  )
  create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('dto') dto: string,
    @Req() req,
  ) {
    const userId = req.staffId;
    const createDto = dto ? JSON.parse(dto) : {};
    return this.messageService.create(createDto, userId, files || []);
  }

  @Get('my-messages')
  @UseGuards(StaffAuthGuard)
  findMyMessages(@Req() req) {
    const staffId = req.staffId;
    return this.messageService.findMyMessages(staffId);
  }

  @Get()
  findAll() {
    return this.messageService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.messageService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(StaffAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `ceo-broadcasts/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('dto') dto: string,
    @Req() req,
  ) {
    const userId = req.staffId;
    const updateDto = dto ? JSON.parse(dto) : {};
    return this.messageService.update(id, updateDto, userId, files || []);
  }

  @Delete(':id')
  @UseGuards(StaffAuthGuard)
  remove(@Param('id') id: string) {
    return this.messageService.remove(id);
  }

  @Post('mark-read/:id')
  @UseGuards(StaffAuthGuard)
  markAsRead(@Param('id') id: string, @Req() req) {
    const staffId = req.staffId;
    return this.messageService.markAsRead(id, staffId, req);
  }

  @Get('readers/:id')
  getReaders(@Param('id') id: string) {
    return this.messageService.getReaders(id);
  }

  @Get('read-stats/:id')
  getReadStats(@Param('id') id: string) {
    return this.messageService.getReadStats(id);
  }
}
