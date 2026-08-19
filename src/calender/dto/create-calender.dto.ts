import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { EventType, RecurrenceFrequency } from '../entities/calender.entity';

export class CreateCalenderDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  meetingLink?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsEnum(EventType)
  type: EventType;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  recurrenceFrequency?: RecurrenceFrequency;

  @IsOptional()
  @IsString()
  recurrenceRule?: string;

    @IsOptional()
    @IsDateString()
    recurrenceEndDate?: string;

  @IsArray()
  attendees: number[]; // Staff IDs
}
