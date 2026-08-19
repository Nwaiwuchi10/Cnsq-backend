// src/message/dto/create-message.dto.ts
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateMessageCeoDto {
  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  attachments?: string[];
}
