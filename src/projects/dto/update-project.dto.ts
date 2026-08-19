import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsOptional, IsString, IsInt, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CreateProjectDto } from './create-project.dto';

class UpdateAssignmentDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  staffId: number;

  @IsString()
  role: string;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAssignmentDto)
  assignments?: UpdateAssignmentDto[];
}
