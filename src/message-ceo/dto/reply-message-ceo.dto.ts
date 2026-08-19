import { IsNotEmpty, IsString } from 'class-validator';

export class ReplyMessageCeoDto {
  @IsString()
  @IsNotEmpty()
  content: string;
}
