import { IsOptional, IsNumberString, IsString } from 'class-validator';

export class GetQuoteDto {
  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;
}
