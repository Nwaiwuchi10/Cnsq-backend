import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddTicketCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsString({ each: true })
  attachments?: string[];
}
