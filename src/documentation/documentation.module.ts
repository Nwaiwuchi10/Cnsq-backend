import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentationController } from './documentation.controller';
import { DocumentationService } from './documentation.service';
import { Documentation } from './entities/documentation.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Documentation, Staff, Admin])],
  controllers: [DocumentationController],
  providers: [DocumentationService],
})
export class DocumentationModule {}
