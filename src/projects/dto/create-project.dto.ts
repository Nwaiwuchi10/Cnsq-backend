import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  IsInt,
  ValidateIf,
} from 'class-validator';
import { ProjectPriority, ProjectStatus } from '../entities/project.entity';

export class CreateProjectDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  projectName: string;

  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsString()
  timeLine?: string;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsEnum(ProjectPriority)
  priority?: ProjectPriority;

  @IsOptional()
  @ValidateIf((o, v) => v !== '' && v !== null)
  @IsUrl()
  @MaxLength(500)
  prodUrl?: string;

  @IsOptional()
  @ValidateIf((o, v) => v !== '' && v !== null)
  @IsUrl()
  @MaxLength(500)
  stagingUrl?: string;

  @IsOptional()
  apk?: string;

  @IsOptional()
  @IsDateString()
  startDate: string; // accept ISO string

  @IsOptional()
  @IsDateString()
  endDate: string;

  @IsInt()
  createdById: number;

  @IsInt()
  @IsNotEmpty()
  departmentId: number;
}
