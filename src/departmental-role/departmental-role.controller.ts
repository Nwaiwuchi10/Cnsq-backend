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
  ParseIntPipe,
} from '@nestjs/common';
import { DepartmentalRoleService } from './departmental-role.service';
import { CreateDepartmentalRoleDto } from './dto/create-departmental-role.dto';
import { UpdateDepartmentalRoleDto } from './dto/update-departmental-role.dto';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';

@Controller('departmental-role')
export class DepartmentalRoleController {
  constructor(
    private readonly departmentalRoleService: DepartmentalRoleService,
  ) {}

  @Post()
  @UseGuards(UserAuthGuard)
  create(
    @Body() createDepartmentalRoleDto: CreateDepartmentalRoleDto,
    @Req() req,
  ) {
    const userId = req.userId;

    return this.departmentalRoleService.create(
      createDepartmentalRoleDto,
      userId,
    );
  }

  @Get()
  findAll() {
    return this.departmentalRoleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentalRoleService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDepartmentalRoleDto: UpdateDepartmentalRoleDto,
  ) {
    return this.departmentalRoleService.update(+id, updateDepartmentalRoleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departmentalRoleService.remove(+id);
  }
  @Get(':id/job-titles')
  async getJobTitles(@Param('id', ParseIntPipe) id: number) {
    return await this.departmentalRoleService.getJobTitlesByDepartmentalRole(
      id,
    );
  }
}
