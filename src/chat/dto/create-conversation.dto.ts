// src/chat/dto/create-conversation.dto.ts

import { ConversationType } from '../entities/conversation.entity';
import { IsEnum, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsArray()
  memberIds?: number[];
}

// src/chat/dto/add-members.dto.ts
export class AddMembersDto {
  @IsArray()
  memberIds: number[]; // staff ids
}

// src/chat/dto/send-message.dto.ts
export class SendMessageDtos {
  conversationId: string;
  text?: string;
  parentId?: string | null;
  attachmentIds?: string[]; // if you persist attachment records
}
