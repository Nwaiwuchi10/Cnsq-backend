import { PartialType } from '@nestjs/mapped-types';
import { CreateHeadOfDepartmentDto } from './create-headofdepartment.dto';

export class UpdateHeadofdepartmentDto extends PartialType(
  CreateHeadOfDepartmentDto,
) {}
