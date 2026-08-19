import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsDateString, IsArray } from 'class-validator';
import { LeaveType } from '../entities/leave-request.entity';

export class CreateLeaveRequestDto {
  @IsEnum(LeaveType)
  @IsNotEmpty()
  leaveType: LeaveType;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsInt()
  @IsNotEmpty()
  handoverStaffId: number;

  @IsString()
  @IsOptional()
  handoverNotes?: string;

  @IsString()
  @IsOptional()
  attachedDocument?: string;

  @IsArray()
  @IsNotEmpty()
  supervisorIds: number[];
}
