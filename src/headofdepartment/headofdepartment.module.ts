import { Module } from '@nestjs/common';
import { HeadofdepartmentService } from './headofdepartment.service';
import { HeadofdepartmentController } from './headofdepartment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from 'src/departments/entities/department.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { HeadOfDepartment } from './entities/headofdepartment.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Department, Admin, HeadOfDepartment, Staff]),
  ],
  controllers: [HeadofdepartmentController],
  providers: [HeadofdepartmentService],
})
export class HeadofdepartmentModule {}
