// src/calls/dto/initiate-call.dto.ts
import { IsEnum, IsString, IsUUID } from 'class-validator';
import { CallType, CallScope } from '../entities/call.entity';

export class InitiateCallDto {
  @IsUUID()
  conversationId: string;

  @IsEnum(CallType)
  type: CallType; // 'audio' | 'video'

  @IsEnum(CallScope)
  scope: CallScope; // 'dm' | 'group'
}
