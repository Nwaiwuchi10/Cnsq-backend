import { IsEmail, IsString } from 'class-validator';

export class StaffEmployeeLoginDto {
  @IsString()
  employeeCode: string;

  @IsString()
  password: string;
}

export class StaffLoginDto {
  @IsString()
  identifier: string; // can be employeeCode or email

  @IsString()
  password: string;
}
