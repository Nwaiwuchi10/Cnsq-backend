// src/staff/dto/change-password.dto.ts
import { IsNotEmpty, MinLength, IsString } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  oldPassword: string;

  @IsNotEmpty()
  newPassword: string;

  @IsNotEmpty()
  confirmNewPassword: string;
}
