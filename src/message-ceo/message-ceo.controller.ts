import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MessageCeoService } from './message-ceo.service';
import { CreateMessageCeoDto } from './dto/create-message-ceo.dto';
import { UpdateMessageCeoDto } from './dto/update-message-ceo.dto';
import { ReplyMessageCeoDto } from './dto/reply-message-ceo.dto';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';
import * as multerS3 from 'multer-s3';

@Controller('messageceo')
export class MessageCeoController {
  constructor(private readonly messageCeoService: MessageCeoService) {}
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
    const userId = req.staffId;
    const createdto = dto ? JSON.parse(dto) : {};
    // const userId = req.staffId;
    return this.messageCeoService.create(createdto, userId, file);
  }

  @Get('my-messages')
  @UseGuards(StaffAuthGuard)
  findMyMessages(@Req() req) {
    const staffId = req.staffId;
    return this.messageCeoService.findMyMessages(staffId);
  }

  @Get('for-ceo')
  @UseGuards(StaffAuthGuard)
  getMessagesToCeo(@Req() req) {
    const ceoId = req.staffId;
    return this.messageCeoService.getMessagesToCeo(ceoId);
  }

  @Get()
  findAll() {
    return this.messageCeoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.messageCeoService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateMessageCeoDto: UpdateMessageCeoDto,
  ) {
    return this.messageCeoService.update(id, updateMessageCeoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.messageCeoService.remove(id);
  }

  @Patch(':id/reply')
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
          cb(null, `ceo-replies/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  reply(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body('dto') dto: string,
    @Req() req,
  ) {
    const userId = req.staffId;
    const replyDto = dto ? JSON.parse(dto) : {};
    return this.messageCeoService.replyToMessage(id, replyDto, userId, files || []);
  }
}
