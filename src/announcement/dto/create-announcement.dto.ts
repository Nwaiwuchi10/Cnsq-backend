import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAnnouncementDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  // ✅ Array of staff IDs
  @IsArray()
  @IsOptional()
  selectedStaffIds?: number[];

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  fileUrls?: string[];
}
export class MarkAnnouncementReadDto {
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}

export class MarkAnnouncementUnReadDto {
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;
}
