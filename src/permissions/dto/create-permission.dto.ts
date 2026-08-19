// src/permissions/dto/create-permission.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @IsNotEmpty()
  action: string; // e.g. "create_project"
}
