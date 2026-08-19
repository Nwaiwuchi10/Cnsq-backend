// src/departmental-role/dto/create-departmental-role.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsInt } from 'class-validator';

export class CreateDepartmentalRoleDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;
  @IsInt()
  @IsNotEmpty()
  department: number;
}
