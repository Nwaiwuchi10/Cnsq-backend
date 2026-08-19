export class CreateStaffRegisterDto {}
// src/staff/dto/staff-register.dto.ts
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
  ArrayNotEmpty,
  IsArray,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

import {
  EmploymentStatus,
  EmploymentType,
  WorkMode,
} from '../entities/staff-employment.entity';
import { Gender, MaritalStatus } from '../entities/staff-register.entity';

// === Address Details ===
export class AddressDetailsDto {
  @IsString()
  @Length(1, 80)
  city: string;

  @IsString()
  @Length(1, 80)
  state: string;

  @IsString()
  @Length(1, 80)
  country: string;

  @IsOptional()
  @IsString()
  @Length(0, 20)
  postalCode?: string;
}

// === Organization / Employment ===
export class EmploymentDetailsDto {
  @IsOptional()
  @IsString()
  employeeCode?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayNotEmpty()
  jobTitle: string[];

  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @IsEnum(WorkMode)
  workMode: WorkMode;

  @IsDateString()
  hireDate: string;

  @IsOptional()
  @IsDateString()
  contractEndDate?: string;

  @IsEnum(EmploymentStatus)
  status: EmploymentStatus;

  @IsOptional()
  @IsString()
  reportingManager?: string;

  @IsOptional()
  @IsString()
  directReport?: string;

  @IsOptional()
  @IsString()
  workLocation?: string;

  @IsInt()
  @IsNotEmpty()
  departmentId: number;

  @IsInt()
  @IsNotEmpty()
  departmentalRoleId: number;
}

// === Master DTO ===
export class StaffRegisterDto {
  @IsString()
  @Length(1, 80)
  firstName: string;

  @IsString()
  @Length(1, 80)
  lastName: string;

  @IsOptional()
  @IsString()
  photoUrl: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hobbies: string[];

  @IsDateString()
  dateOfBirth: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @IsEmail()
  @Transform(({ value }) => value.toLowerCase().trim())
  email: string;

  @IsString()
  @Length(5, 30)
  phone: string;
  //   @ValidateNested()
  //   @Type(() => PersonalDetailsDto)
  //   personal: PersonalDetailsDto;

  @ValidateNested()
  @Type(() => AddressDetailsDto)
  address: AddressDetailsDto;

  @ValidateNested()
  @Type(() => EmploymentDetailsDto)
  employment: EmploymentDetailsDto;
}
