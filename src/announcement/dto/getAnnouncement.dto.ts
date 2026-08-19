// src/announcement/dto/getAnnouncement.dto.ts
import { IsOptional, IsNumber, IsString } from 'class-validator';

export class GetAnnouncementDto {
  @IsOptional()
  @IsNumber()
  page?: number;

  @IsOptional()
  @IsNumber()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;
}
