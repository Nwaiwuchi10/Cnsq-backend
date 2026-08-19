import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Post()
  @UseGuards(UserAuthGuard)
  create(@Body() createDepartmentDto: CreateDepartmentDto, @Req() req) {
    const userId = req.userId;
    return this.departmentsService.create(createDepartmentDto, userId);
  }

  @Get()
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentsService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(UserAuthGuard)
  update(
    @Param('id') id: string,
    @Body() updateDepartmentDto: UpdateDepartmentDto,
    @Req() req,
  ) {
    const userId = req.userId;
    return this.departmentsService.update(+id, updateDepartmentDto, userId);
  }

  @Delete(':id')
  @UseGuards(UserAuthGuard)
  remove(@Param('id') id: string, @Req() req) {
    const userId = req.userId;
    return this.departmentsService.remove(+id, userId);
  }
}
