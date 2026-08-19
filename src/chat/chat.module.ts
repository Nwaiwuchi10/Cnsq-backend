import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from './entities/conversation.entity';

import { Reaction } from './entities/reaction.entity';
import { Mention } from './entities/mention.entity';
import { ConversationMember } from './entities/conversation-member.entity';

import { MessageRead } from './entities/message-read.entity';
;
import { Attachment } from './entities/attachment.entity';
import { Message } from './entities/Message.entity';
import { ThreadReply } from './entities/thread-reply.entity';
import { ThreadRead } from './entities/thread-read.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { ChatGateway } from '../chat/gateway/chat.gateway';
import { PushNotification } from 'src/push-notification/entities/push-notification.entity';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { StaffRegisterModule } from 'src/staff-register/staff-register.module';

import { ScheduledMessage } from './entities/scheduled-message.entity';
import { ChatMessageRead } from './entities/chat-message-read.entity';

@Module({
  imports: [
    StaffRegisterModule,
    TypeOrmModule.forFeature([
      Conversation,
      Message,
      ThreadReply,
      ThreadRead,
      Reaction,
      Mention,
      ConversationMember,
      Attachment,
      MessageRead,
      Staff,
      PushNotification,
      ScheduledMessage,
      ChatMessageRead,
    ]),
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, PushNotificationService],
})
export class ChatModule { }
