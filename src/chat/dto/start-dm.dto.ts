// src/chat/dto/start-dm.dto.ts
import { IsInt } from 'class-validator';

export class StartDmDto {
  @IsInt()
  targetUserId: number;
}
