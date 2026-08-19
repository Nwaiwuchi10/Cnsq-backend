import { IsString, IsOptional, IsUrl, IsNotEmpty } from 'class-validator';

export class CreateDocumentationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  link?: string;

  @IsOptional()
  files?: string[];
}
