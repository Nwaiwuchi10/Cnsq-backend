import { Module } from '@nestjs/common';
import { DepartmentalRoleService } from './departmental-role.service';
import { DepartmentalRoleController } from './departmental-role.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DepartmentalRole } from './entities/departmental-role.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { Department } from 'src/departments/entities/department.entity';
import { StaffEmployment } from 'src/staff-register/entities/staff-employment.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DepartmentalRole,
      Admin,
      Department,
      StaffEmployment,
    ]),
  ],
  controllers: [DepartmentalRoleController],
  providers: [DepartmentalRoleService],
})
export class DepartmentalRoleModule {}
