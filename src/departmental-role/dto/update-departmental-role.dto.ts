import { PartialType } from '@nestjs/mapped-types';
import { CreateDepartmentalRoleDto } from './create-departmental-role.dto';

export class UpdateDepartmentalRoleDto extends PartialType(CreateDepartmentalRoleDto) {}
