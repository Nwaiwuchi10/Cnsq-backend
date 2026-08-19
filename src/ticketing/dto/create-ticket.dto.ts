import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TicketPriority } from '../entities/ticket.entity';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @IsNotEmpty()
  departmentId: number;

  @IsEnum(TicketPriority)
  @IsNotEmpty()
  priority: TicketPriority;

  @IsOptional()
  @IsString({ each: true })
  attachments?: string[];

  @IsOptional()
  linkedProjectId?: number;

  @IsOptional()
  linkedTaskId?: number;
}
