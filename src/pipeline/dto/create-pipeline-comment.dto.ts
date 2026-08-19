import { IsString, IsNotEmpty, IsOptional, IsUUID, IsArray } from 'class-validator';

export class CreatePipelineCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
