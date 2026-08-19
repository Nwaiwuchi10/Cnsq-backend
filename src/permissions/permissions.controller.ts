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
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @UseGuards(UserAuthGuard)
  create(@Body() createPermissionDto: CreatePermissionDto, @Req() req) {
    const userId = req.userId;
    return this.permissionsService.create(createPermissionDto, userId);
  }

  @Get()
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(UserAuthGuard)
  update(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
    @Req() req,
  ) {
    const userId = req.userId;
    return this.permissionsService.update(+id, updatePermissionDto, userId);
  }

  @Delete(':id')
  @UseGuards(UserAuthGuard)
  remove(@Param('id') id: string, @Req() req) {
    const userId = req.userId;
    return this.permissionsService.remove(+id, userId);
  }
}
