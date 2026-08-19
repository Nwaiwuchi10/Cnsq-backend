import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  @Transform(({ value }) => value.toLowerCase()) // Transform email to lowercase
  email: string;

  @IsString()
  password: string;
}
