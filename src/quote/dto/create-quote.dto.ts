import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateQuoteDto {
  @IsOptional()
  @IsString()
  subject: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsArray()
  @IsOptional()
  fileUrl?: string[];
}
