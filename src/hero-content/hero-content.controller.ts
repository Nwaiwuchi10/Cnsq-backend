import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { HeroContentService } from './hero-content.service';
import { CreateHeroContentDto } from './dto/create-hero-content.dto';
import { UpdateHeroContentDto } from './dto/update-hero-content.dto';
import { UserAuthGuard } from '../admin/guard/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multerS3 from 'multer-s3';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';

@Controller('hero-content')
export class HeroContentController {
  constructor(private readonly heroContentService: HeroContentService) {}

  @Post()
  @UseGuards(UserAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `hero-content/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    }),
  )
  async create(
    @Body() createHeroContentDto: CreateHeroContentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const s3File = file as Express.Multer.File & { location?: string };
    if (!s3File || !s3File.location) {
      throw new BadRequestException('Image upload failed');
    }
    createHeroContentDto.imageUrl = s3File.location;
    return this.heroContentService.create(createHeroContentDto);
  }

  @Get()
  findAll() {
    return this.heroContentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.heroContentService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(UserAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `hero-content/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() updateHeroContentDto: UpdateHeroContentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (file) {
      const s3File = file as Express.Multer.File & { location?: string };
      if (s3File.location) {
        updateHeroContentDto.imageUrl = s3File.location;
      }
    }
    return this.heroContentService.update(id, updateHeroContentDto);
  }

  @Delete(':id')
  @UseGuards(UserAuthGuard)
  remove(@Param('id') id: string) {
    return this.heroContentService.remove(id);
  }
}
