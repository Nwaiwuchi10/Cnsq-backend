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
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { AdminLoginDto } from './dto/login.dto';
import { UserAuthGuard } from './guard/auth.guard';
import { Admin } from './entities/admin.entity';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Post()
  create(@Body() createAdminDto: CreateAdminDto) {
    return this.adminService.create(createAdminDto);
  }

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminService.login(dto);
  }

  @Post('promote/:staffId')
  @UseGuards(UserAuthGuard)
  async promoteStaffToAdmin(@Param('staffId') staffId: number, @Req() req) {
    const userId = req.userId;
    return this.adminService.promoteStaffToAdmin(+staffId, userId);
  }

  @Get()
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search?: string,
  ): Promise<{ data: Admin[]; total: number; page: number; limit: number }> {
    return this.adminService.findAll(Number(page), Number(limit), search);
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.adminService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAdminDto: UpdateAdminDto) {
    return this.adminService.update(+id, updateAdminDto);
  }
  @Patch('toggle-ceo/:staffId')
  @UseGuards(UserAuthGuard)
  async toggleCeoStatus(@Param('staffId') staffId: number, @Req() req) {
    const adminId = req.userId;
    return this.adminService.toggleCeoStatus(+staffId, adminId);
  }

  @Delete('delete/:id')
  @UseGuards(UserAuthGuard)
  remove(@Param('id') id: string, @Req() req) {
    const userId = req.userId;
    return this.adminService.remove(+id, userId);
  }
}
