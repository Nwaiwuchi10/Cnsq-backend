// src/staff/dto/update-staff.dto.ts
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Gender, MaritalStatus } from '../entities/staff-register.entity';
import { Type } from 'class-transformer';

class AddressDto {
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;
}

class EmploymentDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  jobTitle?: string[];

  @IsOptional()
  @IsString()
  employmentType?: string;

  @IsOptional()
  @IsString()
  workMode?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  workLocation?: string;

  @IsOptional()
  @IsDateString()
  hireDate?: string;

  @IsOptional()
  departmentId?: number;

  @IsOptional()
  departmentalRoleId?: number;
}
export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  firstName: string;

  @IsOptional()
  @IsString()
  lastName: string;

  @IsOptional()
  @IsString()
  photoUrl: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hobbies: string[];

  @IsOptional()
  @IsDateString()
  dateOfBirth: string;

  @IsOptional()
  @IsEnum(Gender)
  gender: Gender;

  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @IsOptional()
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone: string;
  // address
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => EmploymentDto)
  employment?: EmploymentDto;
}
