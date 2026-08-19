import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  IsNumber,
  Length,
  IsInt,
} from 'class-validator';
import { PriorityLevel, TaskStatus, URGENCY } from '../entities/task.entity';
import { Type, Transform } from 'class-transformer';

export class CreateTaskDto {
  @IsString()
  @Length(3, 255, { message: 'Title must be between 3 and 255 characters' })
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  taskModule?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(PriorityLevel)
  priority?: PriorityLevel;

  @IsOptional()
  @IsEnum(URGENCY)
  urgency?: URGENCY;

  @IsOptional()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Transform(({ value }) => (value instanceof Date ? value.toISOString() : value))
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsString()
  timeline?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sprint?: number;

  @IsOptional()
  @IsInt()
  projectId?: number;

  @IsOptional()
  @IsInt()
  departmentId?: number;

  // staff assignments
  @IsOptional()
  @IsArray()
  assignedTo?: { staffId: number; role: string }[];
}
