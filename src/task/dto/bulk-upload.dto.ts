import { IsOptional, IsString, IsUrl } from 'class-validator';

export class BulkUploadDto {
  @IsOptional()
  @IsUrl()
  googleSheetUrl?: string;

  // optional free-form field; not required for CSV uploads
  @IsOptional()
  @IsString()
  source?: string;
}
