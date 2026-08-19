// src/staff/dto/assign-role.dto.ts
import { IsArray, ArrayNotEmpty, IsNumber } from 'class-validator';

export class AssignRoleDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  roleIds: number[];
}
