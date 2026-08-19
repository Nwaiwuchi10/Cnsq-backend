// src/roles/dto/create-role.dto.ts
import {
  IsNotEmpty,
  IsString,
  IsArray,
  ArrayNotEmpty,
  ArrayUnique,
} from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  permissions: string[]; // list of permission names e.g. ['create_project', 'update_project']
}
