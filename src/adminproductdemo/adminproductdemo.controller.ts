import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UploadedFile,
  Req,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { AdminproductdemoService } from './adminproductdemo.service';
import { CreateAdminproductdemoDto } from './dto/create-adminproductdemo.dto';
import { UpdateAdminproductdemoDto } from './dto/update-adminproductdemo.dto';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';
import * as multerS3 from 'multer-s3';
import { GetAdminProductDemosDto } from './dto/get-adminproductdemo.dto';
@Controller('adminproductdemo')
export class AdminproductdemoController {
  constructor(
    private readonly adminproductdemoService: AdminproductdemoService,
  ) {}
  @Post()
  @UseGuards(UserAuthGuard)
  @UseInterceptors(
    FileInterceptor('video', {
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
    @Body('dto') dto: string,
    @Req() req,
  ) {
    // const userId = req.staffId ?? req.userId; // Works for both staff or admin
    const userId = req.userId; // Works for both staff or admin
    const createDto: CreateAdminproductdemoDto = dto ? JSON.parse(dto) : {};
    return this.adminproductdemoService.create(createDto, userId, file);
  }
  @Get()
  @UseGuards(UserAuthGuard)
  async getAll(@Query() query: GetAdminProductDemosDto) {
    return this.adminproductdemoService.findAll(query);
  }
  @Get('/all/data')
  findAllData() {
    return this.adminproductdemoService.findAllData();
  }

  @Get(':id')
  findOne(@Param('id') id: number) {
    return this.adminproductdemoService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(UserAuthGuard)
  @UseInterceptors(
    FileInterceptor('video', {
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
    @Param('id') id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('dto') dto: string,
  ) {
    const updateDto: UpdateAdminproductdemoDto = dto ? JSON.parse(dto) : {};
    return this.adminproductdemoService.update(id, updateDto, file);
  }
  @Patch(':id/updates')
  updates(
    @Param('id') id: number,
    @Body() updateAdminproductdemoDto: UpdateAdminproductdemoDto,
  ) {
    return this.adminproductdemoService.updates(id, updateAdminproductdemoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.adminproductdemoService.remove(id);
  }
}
