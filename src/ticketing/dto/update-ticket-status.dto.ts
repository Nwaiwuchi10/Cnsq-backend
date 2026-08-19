import { IsEnum, IsNotEmpty } from 'class-validator';
import { TicketStatus } from '../entities/ticket.entity';

export class UpdateTicketStatusDto {
  @IsEnum(TicketStatus)
  @IsNotEmpty()
  status: TicketStatus;
}
