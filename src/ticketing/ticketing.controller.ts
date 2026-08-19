import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req, UseInterceptors, UploadedFiles, Query } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { TicketingService } from './ticketing.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AddTicketCommentDto } from './dto/add-comment.dto';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';
import * as multerS3 from 'multer-s3';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';

@UseGuards(StaffAuthGuard)
@Controller('ticketing')
export class TicketingController {
  constructor(private readonly ticketingService: TicketingService) {}

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
          cb(null, `tickets/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  create(
    @Req() req, 
    @Body('dto') dtoString: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    const userId = req.staffId || (req.user && (req.user.staffId || req.user.sub || req.user.id));
    const dto: CreateTicketDto = dtoString ? JSON.parse(dtoString) : {};
    if (files && files.length > 0) {
      dto.attachments = files.map((f: any) => f.location);
    }
    return this.ticketingService.createTicket(userId, dto);
  }

  @Get()
  findAll(
    @Req() req,
    @Query('myPageNum') myPageNum: number = 1,
    @Query('myPageSize') myPageSize: number = 10,
    @Query('mySearch') mySearch: string = '',
    @Query('receivedPageNum') receivedPageNum: number = 1,
    @Query('receivedPageSize') receivedPageSize: number = 10,
    @Query('receivedSearch') receivedSearch: string = '',
  ) {
    const userId = req.staffId || (req.user && (req.user.staffId || req.user.sub || req.user.id));
    return this.ticketingService.getTicketsForUser(
      userId,
      myPageNum,
      myPageSize,
      mySearch,
      receivedPageNum,
      receivedPageSize,
      receivedSearch
    );
  }

  @Get('stats')
  getStats(@Req() req) {
    const userId = req.staffId || (req.user && (req.user.staffId || req.user.sub || req.user.id));
    return this.ticketingService.getTicketStats(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketingService.getTicketDetails(id);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req,
    @Param('id') id: string,
    @Body() updateTicketStatusDto: UpdateTicketStatusDto,
  ) {
    const userId = req.staffId || (req.user && (req.user.staffId || req.user.sub || req.user.id));
    return this.ticketingService.updateTicketStatus(userId, id, updateTicketStatusDto);
  }

  @Patch(':id')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname.replace(/\s+/g, '').replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `tickets/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    }),
  )
  updateTicket(
    @Req() req,
    @Param('id') id: string,
    @Body('dto') dtoString: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    const userId = req.staffId || (req.user && (req.user.staffId || req.user.sub || req.user.id));
    const dto: Partial<CreateTicketDto> = dtoString ? JSON.parse(dtoString) : {};
    if (files && files.length > 0) {
      dto.attachments = files.map((f: any) => f.location);
    }
    return this.ticketingService.updateTicket(userId, id, dto);
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
          cb(null, `tickets/comments/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
    }),
  )
  addComment(
    @Req() req,
    @Param('id') id: string,
    @Body('dto') dtoString: string,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    const userId = req.staffId || (req.user && (req.user.staffId || req.user.sub || req.user.id));
    const dto: AddTicketCommentDto = dtoString ? JSON.parse(dtoString) : {};
    if (files && files.length > 0) {
      dto.attachments = files.map((f: any) => f.location);
    }
    return this.ticketingService.addTicketComment(userId, id, dto);
  }
}
