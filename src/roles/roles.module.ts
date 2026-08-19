import { Module } from '@nestjs/common';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { Permission } from 'src/permissions/entities/permission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Admin, Permission])],
  controllers: [RolesController],
  providers: [RolesService],
})
export class RolesModule {}
