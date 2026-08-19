import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { QuoteService } from './quote.service';
import { CreateQuoteDto } from './dto/create-quote.dto';

import { GetQuoteDto } from './dto/getQuote.dto';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';
import { Quote } from './entities/quote.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';
import * as multerS3 from 'multer-s3';

@Controller('quote')
export class QuoteController {
  constructor(private readonly quoteService: QuoteService) {}

  @Post()
  @UseGuards(UserAuthGuard)
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
          cb(null, `product-demos/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max video size
    }),
  )
  create(
    @UploadedFile() file: Express.Multer.File,
    @Body('dto') createQuoteDto: string,
    @Req() req,
  ) {
    // const userId = req.staffId ?? req.userId; // Works for both staff or admin
    const userId = req.userId; // Works for both staff or admin
    const createDto: CreateQuoteDto = createQuoteDto
      ? JSON.parse(createQuoteDto)
      : {};
    return this.quoteService.create(createDto, userId, file);
  }

  @Get()
  findAll(@Query() query: GetQuoteDto) {
    return this.quoteService.findAll(query);
  }
  @Get('all/today')
  async getQuotesForToday(): Promise<Quote[]> {
    return await this.quoteService.getQuotesForToday();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.quoteService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(UserAuthGuard)
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
          cb(null, `product-demos/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('dto') dto: string,
    @Req() req,
  ) {
    const adminId = req.userId;
    const updateDto: CreateQuoteDto = dto ? JSON.parse(dto) : {};
    return this.quoteService.update(id, updateDto, adminId, file);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.quoteService.remove(id);
  }
}
