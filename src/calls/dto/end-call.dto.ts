// src/calls/dto/end-call.dto.ts
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CallStatus } from '../entities/call.entity';

export class EndCallDto {
  @IsUUID()
  callId: string;

  @IsEnum(CallStatus)
  @IsOptional()
  status?: CallStatus; // 'ended' | 'missed' | 'declined'
}
