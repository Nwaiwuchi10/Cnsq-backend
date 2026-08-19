import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LeaveStatus } from '../entities/leave-request.entity';

export class UpdateLeaveStatusDto {
  @IsEnum(LeaveStatus)
  @IsNotEmpty()
  status: LeaveStatus;

  @IsString()
  @IsOptional()
  reviewNotes?: string;
}
