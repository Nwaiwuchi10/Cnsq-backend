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
} from '@nestjs/common';
import { HeadofdepartmentService } from './headofdepartment.service';
import { CreateHeadOfDepartmentDto } from './dto/create-headofdepartment.dto';
import { UpdateHeadofdepartmentDto } from './dto/update-headofdepartment.dto';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';

@Controller('headofdepartment')
export class HeadofdepartmentController {
  constructor(
    private readonly headofdepartmentService: HeadofdepartmentService,
  ) {}

  @Get('staff/my-departments')
  @UseGuards(StaffAuthGuard)
  async getMyDepartments(@Req() req) {
    const staffId = req.staffId;
    return this.headofdepartmentService.findDepartmentsByStaff(staffId);
  }

  @Post()
  @UseGuards(UserAuthGuard)
  create(
    @Body() dto: CreateHeadOfDepartmentDto,
    @Req() req,
  ) {
    return this.headofdepartmentService.create(
      dto,
      req.userId,
    );
  }

  @Get()
  findAll() {
    return this.headofdepartmentService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.headofdepartmentService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(UserAuthGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateHeadofdepartmentDto,
    @Req() req,
  ) {
    return this.headofdepartmentService.update(+id, dto, req.userId);
  }

  @Delete(':id')
  @UseGuards(UserAuthGuard)
  remove(@Param('id') id: string, @Req() req) {
    return this.headofdepartmentService.remove(+id, req.userId);
  }
}
