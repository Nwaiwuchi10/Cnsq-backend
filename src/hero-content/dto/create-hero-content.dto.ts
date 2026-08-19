import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';

export class CreateHeroContentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  tag: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  link: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
