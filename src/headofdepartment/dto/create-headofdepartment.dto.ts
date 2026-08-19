import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateHeadOfDepartmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsNumber()
  @IsNotEmpty()
  staffId: number;

  @IsNumber()
  @IsNotEmpty()
  departmentId: number;
}
