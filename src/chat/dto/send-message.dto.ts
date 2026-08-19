// src/chat/dto/send-message.dto.ts
export class SendMessageDto {
  conversationId?: string; // existing -- optional now
  targetUserId?: number; // new: staff id of the recipient (for 1:1 DM)
  text?: string;
  parentId?: string | null;
  attachmentIds?: string[]; // if you persist attachment records
}
