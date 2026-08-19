import { IsInt, IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsOptional()
  @IsInt()
  mentionedStaffId?: number;
}
export class EditCommentDto {
  @IsOptional()
  @IsString()
  text?: string;
  @IsOptional()
  @IsInt()
  mentionedStaffId?: number;
}
