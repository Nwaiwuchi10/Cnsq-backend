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
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @UseGuards(UserAuthGuard)
  create(@Body() createRoleDto: CreateRoleDto, @Req() req) {
    const userId = req.userId;
    return this.rolesService.create(createRoleDto, userId);
  }

  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(UserAuthGuard)
  update(
    @Param('id') id: string,
    @Body() updateRoleDto: UpdateRoleDto,
    @Req() req,
  ) {
    const userId = req.userId;
    return this.rolesService.update(+id, updateRoleDto, userId);
  }

  @Delete(':id')
  @UseGuards(UserAuthGuard)
  remove(@Param('id') id: string, @Req() req) {
    const userId = req.userId;
    return this.rolesService.remove(+id, userId);
  }

  // GET /roles/name/Hiring Manager/staff
  @Get('name/:roleName/staff')
  async getStaffByRoleName(@Param('roleName') roleName: string) {
    return this.rolesService.getStaffByRoleName(roleName);
  }

  // GET /roles/1/staff
  @Get(':id/staff')
  async getStaffByRoleId(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.getStaffByRoleId(id);
  }
}
