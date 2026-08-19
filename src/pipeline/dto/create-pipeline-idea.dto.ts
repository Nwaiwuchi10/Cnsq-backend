import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray } from 'class-validator';

export class CreatePipelineIdeaDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsNumber()
  departmentId?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
