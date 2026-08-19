import { PartialType } from '@nestjs/mapped-types';
import { CreateStaffRegisterDto } from './create-staff-register.dto';

export class UpdateStaffRegisterDto extends PartialType(CreateStaffRegisterDto) {}
