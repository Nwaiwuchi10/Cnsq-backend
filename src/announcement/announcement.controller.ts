import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';
import * as multerS3 from 'multer-s3';
import { AnnouncementService } from './announcement.service';
import {
  CreateAnnouncementDto,
  MarkAnnouncementReadDto,
  MarkAnnouncementUnReadDto,
} from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';
import { GetAnnouncementDto } from './dto/getAnnouncement.dto';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';

@Controller('announcement')
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) { }

  @Post()
  @UseGuards(UserAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: (req, file, cb) => cb(null, file.mimetype),
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `announcement-files/${Date.now()}-${sanitized}`);
        },
      }),
      //  accept only image files
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(new BadRequestException('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  create(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('dto') dtoStr: string,
    @Req() req,
  ) {
    const adminId = req.userId;
    const createAnnouncementDto: CreateAnnouncementDto = dtoStr
      ? JSON.parse(dtoStr)
      : {} as CreateAnnouncementDto;
    const fileUrls = files ? files.map((f: any) => f.location) : [];
    createAnnouncementDto.fileUrls = fileUrls;
    return this.announcementService.create(createAnnouncementDto, adminId);
  }
  @Get()
  @UseGuards(UserAuthGuard)
  async getAll(@Query() query: GetAnnouncementDto) {
    return this.announcementService.findAll(query);
  }
  @Get('all/data')
  findAllData() {
    return this.announcementService.findAllData();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.announcementService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(UserAuthGuard)
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
          cb(null, `announcement-files/${Date.now()}-${sanitized}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
          return cb(new BadRequestException('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
    }),
  )
  update(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('dto') dtoStr: string,
  ) {
    const updateAnnouncementDto: UpdateAnnouncementDto = dtoStr
      ? JSON.parse(dtoStr)
      : {} as UpdateAnnouncementDto;
    const fileUrls = files ? files.map((f: any) => f.location) : [];
    if (fileUrls.length > 0) {
      updateAnnouncementDto.fileUrls = fileUrls;
    }
    return this.announcementService.update(+id, updateAnnouncementDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.announcementService.remove(+id);
  }

  @UseGuards(StaffAuthGuard)
  @Post(':announcementId/read')
  async markRead(
    @Param('announcementId', ParseIntPipe) announcementId: number,
    @Req() req,
  ) {
    const staffId = req.staffId;
    return this.announcementService.markAsRead(announcementId, staffId, req);
  }

  @Delete(':announcementId/unread')
  @UseGuards(StaffAuthGuard)
  markAsUnread(
    @Param('announcementId', ParseIntPipe) announcementId: number,
    @Req() req,
  ) {
    const staffId = req.staffId;
    return this.announcementService.markAsUnread(announcementId, staffId);
  }
  // Get staff that read an announcement
  @Get(':announcementId/readers')
  getReaders(@Param('announcementId', ParseIntPipe) announcementId: number) {
    return this.announcementService.getReaders(announcementId);
  }
  // announcement.controller.ts
  @Get(':announcementId/read-stats')
  getReadStats(@Param('announcementId', ParseIntPipe) announcementId: number) {
    return this.announcementService.getReadUnreadCount(announcementId);
  }
}
