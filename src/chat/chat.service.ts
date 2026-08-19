// Channel conversation service & push notifications enhancement
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Conversation, ConversationType } from './entities/conversation.entity';
import { Brackets, ILike, In, Not, MoreThan, Repository } from 'typeorm';
import {
  ConversationMember,
  MemberRole,
} from './entities/conversation-member.entity';
import { Message, MessageType } from './entities/Message.entity';

import { Staff } from 'src/staff-register/entities/staff-register.entity';
import {
  CreateConversationDto,
  SendMessageDtos,
} from './dto/create-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { Attachment } from './entities/attachment.entity';
import { MessageRead } from './entities/message-read.entity';
import { ChatGateway } from './gateway/chat.gateway';
import * as webpush from 'web-push';
import { PushNotification } from 'src/push-notification/entities/push-notification.entity';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { Mention } from './entities/mention.entity';
import { ThreadReply } from './entities/thread-reply.entity';
import { ThreadRead } from './entities/thread-read.entity';
import { Reaction } from './entities/reaction.entity';


import { ScheduledMessage, ScheduleFrequency } from './entities/scheduled-message.entity';
import { MailService } from 'src/staff-register/service/mail.service';

webpush.setVapidDetails(
  `mailto:${process.env.ADMIN_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);
@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(ConversationMember)
    private memberRepo: Repository<ConversationMember>,
    @InjectRepository(Message) private messageRepo: Repository<Message>,
    @InjectRepository(MessageRead)
    private messageReadRepo: Repository<MessageRead>,
    @InjectRepository(Staff) private staffRepo: Repository<Staff>,
    @InjectRepository(Mention) private mentionRepo: Repository<Mention>,
    @InjectRepository(Attachment)
    private attachmentRepo: Repository<Attachment>,
    @InjectRepository(ThreadReply)
    private threadReplyRepo: Repository<ThreadReply>,
    @InjectRepository(ThreadRead)
    private threadReadRepo: Repository<ThreadRead>,
    @InjectRepository(Reaction)
    private reactionRepo: Repository<Reaction>,
    @InjectRepository(PushNotification)
    private readonly pushRepo: Repository<PushNotification>,
    @InjectRepository(ScheduledMessage)
    private scheduledMsgRepo: Repository<ScheduledMessage>,
    private pushNotificationService: PushNotificationService,
    private readonly mailService: MailService,
  ) {
    // Schedule processor interval (every 60 seconds)
    setInterval(() => {
      this.processScheduledMessages().catch((err) =>
        console.error('Error processing scheduled messages:', err),
      );
    }, 60000);
  }


  async findOrCreateDirectConversation(userA: Staff | number, userBId: number) {
    let staffA: Staff;
    if (typeof userA === 'number') {
      const found = await this.staffRepo.findOne({ where: { id: userA } });
      if (!found) throw new NotFoundException('User not found');
      staffA = found;
    } else {
      staffA = userA;
    }

    const isSelfDM = staffA.id === userBId;

    if (isSelfDM) {
      // Find existing self-DM where conversation type is DM and only userA is the single member
      const allUserDMs = await this.convRepo.find({
        where: { type: ConversationType.DM, createdBy: { id: staffA.id } },
        relations: ['members', 'members.user', 'createdBy'],
      });

      const existingSelf = allUserDMs.find(
        (c) => c.members && c.members.length === 1 && c.members[0]?.user?.id === staffA.id
      );

      if (existingSelf) {
        return existingSelf;
      }

      // Create new self-DM
      const newConv = this.convRepo.create({
        type: ConversationType.DM,
        name: `${staffA.firstName} ${staffA.lastName} (You)`,
        createdBy: staffA,
      });
      await this.convRepo.save(newConv);

      const memberSelf = this.memberRepo.create({
        conversation: newConv,
        user: staffA,
      });
      await this.memberRepo.save(memberSelf);

      return this.convRepo.findOne({
        where: { id: newConv.id },
        relations: ['members', 'members.user', 'createdBy'],
      });
    }

    // Try to find existing DM between two distinct users
    const existing = await this.convRepo
      .createQueryBuilder('c')
      .innerJoin('c.members', 'm')
      .innerJoin('m.user', 'u')
      .where('c.type = :type', { type: ConversationType.DM })
      .andWhere('u.id IN (:...ids)', { ids: [staffA.id, userBId] })
      .groupBy('c.id')
      .having('COUNT(DISTINCT u.id) = 2')
      .getOne();

    if (existing) {
      return this.convRepo.findOne({
        where: { id: existing.id },
        relations: ['members', 'members.user', 'createdBy'],
      });
    }

    // Otherwise create DM
    const other = await this.staffRepo.findOne({
      where: { id: userBId },
    });
    if (!other) throw new NotFoundException('Target user not found');

    const newConv = this.convRepo.create({
      type: ConversationType.DM,
      createdBy: staffA,
    });
    await this.convRepo.save(newConv);

    const memberA = this.memberRepo.create({
      conversation: newConv,
      user: staffA,
    });

    const memberB = this.memberRepo.create({
      conversation: newConv,
      user: other,
    });

    await this.memberRepo.save([memberA, memberB]);

    const savedConv: any = await this.convRepo.findOne({
      where: { id: newConv.id },
      relations: ['members', 'members.user', 'createdBy'],
    });

    if (this.gateway && (this.gateway as ChatGateway).publishConversation) {
      await (this.gateway as ChatGateway).publishConversation(savedConv!);
    }

    return savedConv;
  }

  async findOrCreateDirectConversations(userA: Staff, userBId: number) {
    // try to find conversation of type DM with both members
    const conv = await this.convRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.members', 'm')
      .leftJoinAndSelect('m.user', 'u')
      .where('c.type = :type', { type: ConversationType.DM })
      // require that both user ids exist in members (simple approach)
      .andWhere(
        new Brackets((qb) =>
          qb
            .where('u.id = :a', { a: userA.id })
            .orWhere('u.id = :b', { b: userBId }),
        ),
      )
      .getMany();

    // Filter returned conversations that have exactly the two unique members
    for (const c of conv) {
      const memberIds = c.members.map((m) => m.user.id).sort();
      const idsToMatch = [userA.id, userBId].sort();
      if (
        memberIds.length === 2 &&
        memberIds[0] === idsToMatch[0] &&
        memberIds[1] === idsToMatch[1]
      ) {
        return this.convRepo.findOne({
          where: { id: c.id },
          relations: ['members', 'members.user', 'createdBy'],
        });
      }
    }

    // none found -> create DM conversation
    const other = (await this.staffRepo.findOne({
      where: { id: userBId },
    })) as Staff;
    if (!other) throw new NotFoundException('Target user not found');

    const newConv = this.convRepo.create({
      type: ConversationType.DM,
      createdBy: userA,
    });
    await this.convRepo.save(newConv);

    const memberA = this.memberRepo.create({
      conversation: newConv,
      user: userA,
      role: MemberRole.MEMBER,
    });
    const memberB = this.memberRepo.create({
      conversation: newConv,
      user: other,
      role: MemberRole.MEMBER,
    });

    await this.memberRepo.save([memberA, memberB]);

    return this.convRepo.findOne({
      where: { id: newConv.id },
      relations: ['members', 'members.user', 'createdBy'],
    });
  }

  // ✅ WebSocket Gateway (set dynamically)
  gateway?: any;

  // ✅ Send a message to a conversation or DM
  async sendMessage(
    senderId: number,
    dto: SendMessageDto,
    files?: Express.Multer.File[],
  ) {
    let conversation: Conversation | null = null;

    const sender = await this.staffRepo.findOne({ where: { id: senderId } });
    if (!sender) throw new NotFoundException('Sender not found');

    if (dto.conversationId) {
      conversation = await this.convRepo.findOne({
        where: { id: dto.conversationId },
        relations: ['members', 'members.user'],
      });
      if (!conversation) throw new NotFoundException('Conversation not found');
    } else if (dto.targetUserId) {
      conversation = await this.findOrCreateDirectConversation(
        sender,
        dto.targetUserId,
      );
    } else {
      throw new BadRequestException(
        'Either conversationId or targetUserId must be provided',
      );
    }

    if (!conversation) {
      throw new NotFoundException('Conversation could not be resolved');
    }

    const isMember = conversation.members.some((m) => m.user.id === sender.id);
    if (!isMember) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    const message = this.messageRepo.create({
      conversation: { id: conversation.id } as Conversation,
      author: sender,
      text: dto.text ?? '',
      parent: dto.parentId ? ({ id: dto.parentId } as Message) : undefined,
      edited: false,
      pinned: false,
    });

    let savedMessage = await this.messageRepo.save(message);

    let savedAttachments: Attachment[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        const s3File = file as Express.Multer.File & { location?: string };

        const attachment = this.attachmentRepo.create({
          message: { id: savedMessage.id },
          url: s3File.location,
          filename: s3File.originalname,
          size: s3File.size,
          mimeType: s3File.mimetype,
          provider: 's3',
        });

        const savedAttachment = await this.attachmentRepo.save(attachment);

        savedAttachments.push(savedAttachment);
      }
    }

    savedMessage.attachments = savedAttachments;

    // Reload message with full relational data
    const fullMessage = await this.messageRepo.findOne({
      where: { id: savedMessage.id },
      relations: ['author', 'parent', 'parent.attachments', 'attachments'],
    });

    // Update conversation metadata
    conversation.lastMessage = fullMessage!;
    conversation.lastMessageAt = new Date();
    await this.convRepo.save(conversation);

    // WebSocket notify
    if (this.gateway?.publishMessage) {
      await (this.gateway as ChatGateway).publishMessage(
        fullMessage!,
        conversation,
      );
    }

    // Extract and save mentions
    const mentionedUsernames = this.extractMentions(dto.text || '');
    const mentionedUsers: Staff[] = [];
    for (const fullName of mentionedUsernames) {
      const [firstName, lastName] = fullName.split('-');
      const user = await this.staffRepo.findOne({
        where: { firstName, lastName },
      });
      if (user) {
        const mention = this.mentionRepo.create({ message: fullMessage!, user });
        await this.mentionRepo.save(mention);
        mentionedUsers.push(user);
      }
    }

    // Update unread counts & Notify members via WebSocket and Push Notification
    await this.notifyMembers(
      conversation,
      sender,
      fullMessage!,
      mentionedUsers,
    );

    return fullMessage;
  }

  private async notifyMembers(
    conversation: Conversation,
    sender: Staff,
    message: Message,
    mentionedUsers: Staff[] = [],
  ) {
    for (const m of conversation.members) {
      const uid = m.user.id;

      if (Number(uid) !== Number(sender.id)) {
        // 1. Emit unread count update via WebSocket
        try {
          if (this.gateway?.publishUnreadCount) {
            await (this.gateway as ChatGateway).publishUnreadCount(uid);
          }

          // If it's a DM, also publish the updated conversation list
          if (conversation.type === ConversationType.DM) {
            const dmData = await this.getDMConversationsWithUnreadCounts(uid);
            if (this.gateway?.publishDMConversations) {
              await (this.gateway as ChatGateway).publishDMConversations(
                uid,
                dmData.conversations,
              );
            }
          }
        } catch (err) {
          console.error(`WebSocket notification error for user ${uid}:`, err);
        }

        // 2. Send Push Notification
        try {
          const subscriptions: PushNotification[] =
            await this.pushNotificationService.getByUser(uid);

          if (!subscriptions || subscriptions.length === 0) continue;

          const isMentioned = mentionedUsers.some((u) => u.id === uid);
          const title =
            conversation.type === ConversationType.DM
              ? `New Message from ${sender.firstName} ${sender.lastName}`
              : isMentioned
                ? `${sender.firstName} ${sender.lastName} mentioned you in #${conversation.name || 'Channel'}`
                : `New message in #${conversation.name || 'Channel'}`;

          const body =
            message.text && message.text.trim().length > 0
              ? message.text
              : 'Sent an attachment';

          const payload = JSON.stringify({
            title,
            body,
            url: `/chat`,
            type: 'chat',
          });

          await Promise.all(
            subscriptions.map((sub) =>
              webpush.sendNotification(sub.data, payload).catch((err) => {
                console.error(
                  `Push failed for user ${uid}, subscription ${sub.id}:`,
                  err,
                );
              }),
            ),
          );
        } catch (err) {
          console.error(`Failed to send push notifications to user ${uid}:`, err);
        }
      }
    }
  }

  private async notifyThreadReplyMembers(
    conversation: Conversation,
    sender: Staff,
    reply: ThreadReply,
  ) {
    for (const m of conversation.members) {
      const uid = m.user.id;

      if (Number(uid) !== Number(sender.id)) {
        // 1. Emit unread count update via WebSocket
        try {
          if (this.gateway?.publishUnreadCount) {
            await (this.gateway as ChatGateway).publishUnreadCount(uid);
          }
        } catch (err) {
          console.error(`WebSocket notification error for user ${uid}:`, err);
        }

        // 2. Send Push Notification
        try {
          const subscriptions: PushNotification[] =
            await this.pushNotificationService.getByUser(uid);

          if (!subscriptions || subscriptions.length === 0) continue;

          const title = `New reply in #${conversation.name || 'Channel'}`;

          const body =
            reply.text && reply.text.trim().length > 0
              ? `${sender.firstName}: ${reply.text}`
              : `${sender.firstName} sent an attachment`;

          const payload = JSON.stringify({
            title,
            body,
            url: `/chat`,
            type: 'chat',
          });

          await Promise.all(
            subscriptions.map((sub) =>
              webpush.sendNotification(sub.data, payload).catch((err) => {
                console.error(
                  `Push failed for user ${uid}, subscription ${sub.id}:`,
                  err,
                );
              }),
            ),
          );
        } catch (err) {
          console.error(`Failed to send push notifications to user ${uid}:`, err);
        }
      }
    }
  }

  async sendMessages(
    senderId: number,
    dto: SendMessageDto,
    files?: Express.Multer.File[],
  ) {
    let conversation: Conversation | null = null;

    const sender = await this.staffRepo.findOne({ where: { id: senderId } });
    if (!sender) throw new NotFoundException('Sender not found');

    if (dto.conversationId) {
      conversation = await this.convRepo.findOne({
        where: { id: dto.conversationId },
        relations: ['members', 'members.user'],
      });
      if (!conversation) throw new NotFoundException('Conversation not found');
    } else if (dto.targetUserId) {
      conversation = await this.findOrCreateDirectConversation(
        sender,
        dto.targetUserId,
      );
    } else {
      throw new BadRequestException(
        'Either conversationId or targetUserId must be provided',
      );
    }

    if (!conversation) {
      throw new NotFoundException('Conversation could not be resolved');
    }

    const isMember = conversation.members.some((m) => m.user.id === sender.id);
    if (!isMember) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    const message = this.messageRepo.create({
      conversation: { id: conversation.id } as Conversation,
      author: sender,
      text: dto.text ?? '',
      parent: dto.parentId ? ({ id: dto.parentId } as Message) : undefined,
      edited: false,
      pinned: false,
    });

    let savedMessage = await this.messageRepo.save(message);

    let savedAttachments: Attachment[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        const s3File = file as Express.Multer.File & { location?: string };

        const attachment = this.attachmentRepo.create({
          message: { id: savedMessage.id },
          url: s3File.location,
          filename: s3File.originalname,
          size: s3File.size,
          mimeType: s3File.mimetype,
          provider: 's3',
        });

        const savedAttachment = await this.attachmentRepo.save(attachment);

        savedAttachments.push(savedAttachment);
      }
    }

    savedMessage.attachments = savedAttachments;

    // Reload message with full relational data
    const fullMessage = await this.messageRepo.findOne({
      where: { id: savedMessage.id },
      relations: ['author', 'parent', 'parent.attachments', 'attachments'],
    });

    // Update conversation metadata
    conversation.lastMessage = fullMessage!;
    conversation.lastMessageAt = new Date();
    await this.convRepo.save(conversation);

    // WebSocket notify
    if (this.gateway?.publishMessage) {
      await (this.gateway as ChatGateway).publishMessage(
        fullMessage!,
        conversation,
      );
    }

    // Extract and save mentions
    const mentionedUsernames = this.extractMentions(dto.text || '');
    const mentionedUsers: Staff[] = [];

    if (dto.text?.toLowerCase().includes('@all')) {
      const allMembers = conversation.members?.map((m) => m.user).filter(Boolean) || [];
      for (const user of allMembers) {
        if (user.id !== sender.id) {
          const mention = this.mentionRepo.create({ message: fullMessage!, user });
          await this.mentionRepo.save(mention);
          mentionedUsers.push(user);
        }
      }
    }

    for (const nameTag of mentionedUsernames) {
      if (nameTag.toLowerCase() === 'all') continue;
      const allStaff = await this.staffRepo.find();
      const matched = allStaff.filter(
        (s) =>
          `${s.firstName}${s.lastName}`.toLowerCase().includes(nameTag.toLowerCase()) ||
          s.firstName.toLowerCase() === nameTag.toLowerCase() ||
          s.lastName.toLowerCase() === nameTag.toLowerCase()
      );
      for (const user of matched) {
        if (!mentionedUsers.some((u) => u.id === user.id)) {
          const mention = this.mentionRepo.create({ message: fullMessage!, user });
          await this.mentionRepo.save(mention);
          mentionedUsers.push(user);
        }
      }
    }

    // Update unread counts & Notify members via WebSocket and Push Notification
    await this.notifyMembers(
      conversation,
      sender,
      fullMessage!,
      mentionedUsers,
    );

    return fullMessage;
  }

  async getAllMessagesWithoutPagination(
    conversationId: string,
    userId: number,
  ) {
    // Check if user is a member of the conversation
    const isMember = await this.convRepo
      .createQueryBuilder('c')
      .leftJoin('c.members', 'm')
      .where('c.id = :convId', { convId: conversationId })
      .andWhere('m.user = :userId', { userId })
      .getCount();

    if (!isMember) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    // Fetch all messages
    const messages = await this.messageRepo.find({
      where: { conversation: { id: conversationId } },
      relations: [
        'author',
        'attachments',
        'reactions',
        'mentions',
        'parent',
        'parent.attachments',
      ],
      order: { createdAt: 'DESC' }, //  newest
    });

    return messages;
  }
  async getAllMessages(
    conversationId: string,
    userId: number,
    cursor?: string,
    limit = 30,
  ) {
    // Check if user is a member
    const isMember = await this.convRepo
      .createQueryBuilder('c')
      .leftJoin('c.members', 'm')
      .where('c.id = :convId', { convId: conversationId })
      .andWhere('m.user = :userId', { userId })
      .getCount();

    if (!isMember) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    // Fetch messages with all needed relations
    const qb = this.messageRepo
      .createQueryBuilder('msg')
      .leftJoinAndSelect('msg.author', 'author')
      .leftJoinAndSelect('msg.attachments', 'attachments')
      .leftJoinAndSelect('msg.reactions', 'reactions')
      .leftJoinAndSelect('msg.mentions', 'mentions')
      .leftJoinAndSelect('msg.parent', 'parent')
      .leftJoinAndSelect('parent.attachments', 'parentAttachments')
      .loadRelationCountAndMap('msg.repliesInThreadCount', 'msg.repliesInThread').where('msg.conversationId = :conversationId', { conversationId })
      .andWhere('msg.deletedAt IS NULL')
      .orderBy('msg.createdAt', 'DESC')
      .limit(limit);

    if (cursor) {
      qb.andWhere('msg.id < :cursor', { cursor });
    }

    const messages = await qb.getMany();

    return {
      messages,
      nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null,
    };
  }

  async getAllMessagesy(
    conversationId: string,
    userId: number,
    cursor?: number,
    limit = 30,
  ) {
    const isMember = await this.convRepo
      .createQueryBuilder('c')
      .leftJoin('c.members', 'm')
      .where('c.id = :convId', { convId: conversationId })
      .andWhere('m.user = :userId', { userId })
      .getCount();

    if (!isMember) {
      throw new BadRequestException(
        'You are not a member of this conversation',
      );
    }

    const qb = this.messageRepo
      .createQueryBuilder('msg')
      .leftJoinAndSelect('msg.author', 'author')
      .leftJoinAndSelect('msg.attachments', 'attachments')
      .leftJoinAndSelect('msg.reactions', 'reactions')
      .leftJoinAndSelect('msg.mentions', 'mentions')
      .leftJoinAndSelect('msg.parent', 'parent')
      .leftJoinAndSelect('parent.attachments', 'parentAttachments')
      .loadRelationCountAndMap('msg.repliesInThreadCount', 'msg.repliesInThread').where('msg.conversationId = :conversationId', { conversationId })
      .andWhere('msg.deletedAt IS NULL')
      .orderBy('msg.createdAt', 'DESC')
      .limit(limit);

    if (cursor) {
      qb.andWhere('msg.id < :cursor', { cursor });
    }

    const messages = await qb.getMany();

    return {
      messages,
      nextCursor: messages.length > 0 ? messages[messages.length - 1].id : null,
    };
  }

  async findAll(): Promise<Conversation[]> {
    const conv = await this.convRepo.find({
      relations: ['members', 'createdBy', 'lastMessage', 'lastMessage.author'],
    });
    return conv;
  }

  findOne(id: string) {
    const conv = this.convRepo.findOne({
      where: { id },
      relations: ['members', 'createdBy', 'lastMessage', 'lastMessage.author'],
    });
    if (!conv) {
      throw new NotFoundException('Conversation not found');
    }
    return conv;
  }
  async editMessage(userId: number, messageId: string, newText: string) {
    // Find the message
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: [
        'author',
        'conversation',
        'conversation.members',
        'attachments',
      ],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // Only the author can edit
    if (message.author.id !== userId) {
      throw new BadRequestException('You can only edit your own messages');
    }

    // Update the message
    message.text = newText;
    message.edited = true;
    await this.messageRepo.save(message);

    // Optionally update conversation metadata (e.g., lastMessageAt)
    const conv = message.conversation;
    if (conv.lastMessage?.id === message.id) {
      conv.lastMessage = message;
      conv.lastMessageAt = new Date();
      await this.convRepo.save(conv);
    }
    await this.messageRepo.save(message);
    (this.gateway as ChatGateway).publishEdit(message, conv);

    return message;
  }

  async sendThreadReply(
    senderId: number,
    messageId: string,
    text: string,
    files?: Express.Multer.File[],
    parentReplyId?: string,
  ) {
    const sender = await this.staffRepo.findOne({ where: { id: senderId } });
    if (!sender) throw new NotFoundException('Sender not found');

    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: [
        'conversation',
        'conversation.members',
        'conversation.members.user',
      ],
    });
    if (!message) throw new NotFoundException('Message not found');

    if (message.conversation.type !== ConversationType.CHANNEL) {
      throw new BadRequestException(
        'Thread replies are only allowed in channels',
      );
    }

    let parentReply: ThreadReply | null = null;
    if (parentReplyId) {
      parentReply = await this.threadReplyRepo.findOne({ where: { id: parentReplyId } });
      if (!parentReply) throw new NotFoundException('Parent reply not found');
    }

    const reply = this.threadReplyRepo.create({
      message,
      author: sender,
      text,
      parent: parentReply || undefined,
    });

    const savedReply = await this.threadReplyRepo.save(reply);

    if (files && files.length > 0) {
      for (const file of files) {
        const s3File = file as any;
        const attachment = this.attachmentRepo.create({
          threadReply: savedReply,
          url: s3File.location,
          filename: s3File.originalname,
          size: s3File.size,
          mimeType: s3File.mimetype,
          provider: 's3',
        });
        await this.attachmentRepo.save(attachment);
      }
    }

    const fullReply = await this.threadReplyRepo.findOne({
      where: { id: savedReply.id },
      relations: ['author', 'attachments', 'message', 'parent', 'parent.attachments'],
    });

    if (this.gateway?.publishThreadReply) {
      await (this.gateway as ChatGateway).publishThreadReply(
        fullReply!,
        message.conversation,
      );
    }

    // Push notification for thread reply
    await this.notifyThreadReplyMembers(
      message.conversation,
      sender,
      fullReply!,
    );

    // Update sender's thread read status
    await this.markThreadAsRead(senderId, messageId);

    return fullReply;
  }

  async updateThreadReply(userId: number, replyId: string, text: string) {
    const reply = await this.threadReplyRepo.findOne({
      where: { id: replyId },
      relations: [
        'author',
        'message',
        'message.conversation',
        'message.conversation.members',
        'message.conversation.members.user',
      ],
    });

    if (!reply) throw new NotFoundException('Thread reply not found');
    if (reply.author.id !== userId) {
      throw new BadRequestException('You can only edit your own replies');
    }

    reply.text = text;
    reply.edited = true;
    await this.threadReplyRepo.save(reply);

    if (this.gateway?.publishThreadReplyEdit) {
      await (this.gateway as ChatGateway).publishThreadReplyEdit(
        reply,
        reply.message.conversation,
      );
    }

    return reply;
  }

  async deleteThreadReply(userId: number, replyId: string) {
    const reply = await this.threadReplyRepo.findOne({
      where: { id: replyId },
      relations: [
        'author',
        'message',
        'message.conversation',
        'message.conversation.members',
        'message.conversation.members.user',
      ],
    });

    if (!reply) throw new NotFoundException('Thread reply not found');
    if (reply.author.id !== userId) {
      throw new BadRequestException('You can only delete your own replies');
    }

    await this.threadReplyRepo.remove(reply);

    if (this.gateway?.publishThreadReplyDelete) {
      await (this.gateway as ChatGateway).publishThreadReplyDelete(
        replyId,
        reply.message.conversation,
      );
    }
  }

  async togglePinMessage(userId: number, messageId: string) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: [
        'conversation',
        'conversation.members',
        'conversation.members.user',
      ],
    });
    if (!message) throw new NotFoundException('Message not found');

    message.pinned = !message.pinned;
    await this.messageRepo.save(message);

    if (this.gateway?.publishPinStatus) {
      await (this.gateway as ChatGateway).publishPinStatus(
        message,
        message.conversation,
      );
    }

    return message;
  }

  async toggleReaction(
    userId: number,
    emoji: string,
    messageId?: string,
    threadReplyId?: string,
  ) {
    const user = await this.staffRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let message: Message | null = null;
    let threadReply: ThreadReply | null = null;
    let conversation: Conversation | null = null;

    if (messageId) {
      message = await this.messageRepo.findOne({
        where: { id: messageId },
        relations: [
          'conversation',
          'conversation.members',
          'conversation.members.user',
        ],
      });
      if (!message) throw new NotFoundException('Message not found');
      conversation = message.conversation;
    } else if (threadReplyId) {
      threadReply = await this.threadReplyRepo.findOne({
        where: { id: threadReplyId },
        relations: [
          'message',
          'message.conversation',
          'message.conversation.members',
          'message.conversation.members.user',
        ],
      });
      if (!threadReply) throw new NotFoundException('Thread reply not found');
      conversation = threadReply.message.conversation;
    } else {
      throw new BadRequestException('messageId or threadReplyId is required');
    }

    const existing = await this.reactionRepo.findOne({
      where: {
        user: { id: userId },
        emoji,
        message: message ? { id: message.id } : undefined,
        threadReply: threadReply ? { id: threadReply.id } : undefined,
      },
    });

    if (existing) {
      await this.reactionRepo.remove(existing);
    } else {
      const reaction = this.reactionRepo.create({
        user,
        emoji,
        message: message || undefined,
        threadReply: threadReply || undefined,
      });
      await this.reactionRepo.save(reaction);
    }

    const updatedReactions = await this.getReactionsState(
      messageId,
      threadReplyId,
    );

    if (this.gateway?.publishReaction) {
      await (this.gateway as ChatGateway).publishReaction(
        { messageId, threadReplyId, reactions: updatedReactions },
        conversation!,
      );
    }

    return updatedReactions;
  }

  async getReactionsState(messageId?: string, threadReplyId?: string) {
    const reactions = await this.reactionRepo.find({
      where: {
        message: messageId ? { id: messageId } : undefined,
        threadReply: threadReplyId ? { id: threadReplyId } : undefined,
      },
      relations: ['user'],
    });

    const emojiGroups: any = {};
    reactions.forEach((r) => {
      if (!emojiGroups[r.emoji]) {
        emojiGroups[r.emoji] = {
          count: 0,
          users: [],
        };
      }
      emojiGroups[r.emoji].count++;
      emojiGroups[r.emoji].users.push({
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
      });
    });

    return {
      totalCount: reactions.length,
      emojis: emojiGroups,
    };
  }

  async getThreadReplies(messageId: string) {
    return this.threadReplyRepo.find({
      where: { message: { id: messageId } },
      relations: ['author', 'attachments', 'reactions', 'reactions.user', 'parent', 'parent.attachments'],
      order: { createdAt: 'ASC' },
    });
  }

  async getUserDMs(userId: number): Promise<Conversation[]> {
    return this.convRepo.find({
      where: {
        type: ConversationType.DM,
        members: { user: { id: userId } },
      },
      relations: [
        'members',
        'members.user',
        'lastMessage',
        'lastMessage.author',
      ],
      order: { updatedAt: 'DESC' },
    });
  }
  async getDMConversationsWithUnreadCountsyy(userId: number, search?: string) {
    try {
      const qb = this.convRepo
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.members', 'm')
        .leftJoinAndSelect('m.user', 'u')
        .leftJoinAndSelect('c.lastMessage', 'lm')
        .leftJoinAndSelect('lm.author', 'lma')
        .where('c.type = :type', { type: ConversationType.DM })
        // Ensure current user is a member of the DM
        .andWhere((qb) => {
          const sub = qb
            .subQuery()
            .select('1')
            .from('conversation_members', 'cm')
            .where('cm."conversationId" = c.id')
            .andWhere('cm."userId" = :userId')
            .getQuery();
          return `EXISTS ${sub}`;
        })
        .setParameter('userId', userId);

      // Optional search by user name
      if (search) {
        qb.andWhere(
          `(u.firstName ILIKE :s OR u.lastName ILIKE :s) AND u.id != :userId`,
          { s: `%${search}%`, userId },
        );
      }

      // Unread count subquery (UUID-safe)

      qb.addSelect(
        (sub) =>
          sub
            .select('COUNT(msg.id)')
            .from('chat_messages', 'msg')
            .where('msg."conversationId" = c.id')
            .andWhere('msg."authorId" != :userId', { userId }).andWhere(`
            msg."createdAt" > COALESCE(
              (
                SELECT m2."createdAt"
                FROM "chat_messages" m2
                WHERE m2."id" = (
                  SELECT "lastReadMessageId"::uuid
                  FROM message_reads
                  WHERE "userId" = :userId
                  AND "conversationId" = c.id
                )
              ),
              '1970-01-01'::timestamp
            )
          `)
            .andWhere('msg."deletedAt" IS NULL'),
        'unreadCount',
      );

      qb.orderBy('lm.createdAt', 'DESC', 'NULLS LAST');

      const raw = await qb.getRawAndEntities();

      // Map conversations and separate "other members"
      const conversations = raw.entities.map((c, i) => {
        const otherMembers = c.members.filter((m) => m.user?.id !== userId);
        const peerUser = otherMembers.length > 0 ? otherMembers[0]?.user : c.members[0]?.user;
        const isSelf = c.members.length === 1 && c.members[0]?.user?.id === userId;

        return {
          ...c,
          name: isSelf
            ? `${peerUser?.firstName || 'You'} ${peerUser?.lastName || ''} (You)`
            : c.name || (peerUser ? `${peerUser.firstName} ${peerUser.lastName}` : 'Direct Message'),
          avatar: peerUser?.photoUrl || null,
          peerId: peerUser?.id,
          members: c.members,
          otherMembers: otherMembers.length > 0 ? otherMembers : c.members,
          unreadCount: Number(raw.raw[i].unreadCount) || 0,
        };
      });

      // ---- Staff search for creating new DMs
      let staffMatches: Staff[] = [];
      if (search) {
        staffMatches = await this.staffRepo
          .createQueryBuilder('s')
          .where('s.id != :userId', { userId })
          .andWhere('(s.firstName ILIKE :s OR s.lastName ILIKE :s)', {
            s: `%${search}%`,
          })
          .andWhere(
            `s.id NOT IN (
        SELECT m2."userId"
        FROM conversations c2
        JOIN conversation_members m2 
          ON m2."conversationId" = c2.id
        WHERE c2.type = :dm
        AND c2.id IN (
          SELECT "conversationId"
          FROM conversation_members
          WHERE "userId" = :userId
        )
      )`,
          )
          .setParameter('dm', ConversationType.DM)
          .getMany();
      }

      return {
        conversations,
        staffMatches,
      };
    } catch (err) {
      console.error('DM QUERY ERROR:', err);
      throw err;
    }
  }
  //////
  async getDMConversationsWithUnreadCounts(userId: number, search?: string) {
    try {
      // 1️⃣ Fetch all DM conversations user is a member of
      const qb = this.convRepo
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.members', 'm')
        .leftJoinAndSelect('m.user', 'u')
        .leftJoinAndSelect('c.lastMessage', 'lm')
        .leftJoinAndSelect('lm.author', 'lma')
        .where('c.type = :type', { type: ConversationType.DM })
        // Ensure current user is a member
        .andWhere((qb) => {
          const sub = qb
            .subQuery()
            .select('1')
            .from('conversation_members', 'cm')
            .where('cm."conversationId" = c.id')
            .andWhere('cm."userId" = :userId')
            .getQuery();
          return `EXISTS ${sub}`;
        })
        .setParameter('userId', userId);

      // Optional search by member name
      if (search) {
        qb.andWhere(
          `(u.firstName ILIKE :s OR u.lastName ILIKE :s) AND u.id != :userId`,
          { s: `%${search}%`, userId },
        );
      }

      qb.orderBy('lm.createdAt', 'DESC', 'NULLS LAST');

      const conversations = await qb.getMany();

      // 2️⃣ Get unread counts from the existing function
      const unreadCounts = await this.getDMUnreadCounts(userId);
      const unreadMap = new Map(
        unreadCounts.map((uc) => [uc.conversationId, uc.unreadCount]),
      );

      // 3️⃣ Map unreadCount into each conversation
      const conversationsWithUnread = conversations.map((c) => {
        const otherMembers = c.members.filter((m) => m.user.id !== userId);
        return {
          ...c,
          members: c.members,
          otherMembers,
          unreadCount: unreadMap.get(c.id) || 0, // ← use the value from getDMUnreadCounts
        };
      });

      // 4️⃣ Staff search for creating new DMs
      let staffMatches: Staff[] = [];
      if (search) {
        staffMatches = await this.staffRepo
          .createQueryBuilder('s')
          .where('s.id != :userId', { userId })
          .andWhere('(s.firstName ILIKE :s OR s.lastName ILIKE :s)', {
            s: `%${search}%`,
          })
          .andWhere(
            `s.id NOT IN (
            SELECT m2."userId"
            FROM conversations c2
            JOIN conversation_members m2 
              ON m2."conversationId" = c2.id
            WHERE c2.type = :dm
            AND c2.id IN (
              SELECT "conversationId"
              FROM conversation_members
              WHERE "userId" = :userId
            )
          )`,
          )
          .setParameter('dm', ConversationType.DM)
          .getMany();
      }

      return {
        conversations: conversationsWithUnread,
        staffMatches,
      };
    } catch (err) {
      console.error('DM QUERY ERROR:', err);
      throw err;
    }
  }

  // src/chat/chat.service.ts (excerpt)
  async deleteMessage(userId: number, messageId: string): Promise<void> {
    // load message with author + conversation (and members if possible)
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: [
        'author',
        'conversation',
        'conversation.members',
        'conversation.members.user',
      ],
    });

    if (!message) throw new NotFoundException('Message not found');

    // optional: permission check (uncomment if you want only author/admin to delete)
    // if (message.author.id !== userId) throw new ForbiddenException('Cannot delete others’ messages');

    // mark message as deleted (soft delete)
    message.deletedAt = new Date();

    // NOTE: do NOT replace the text with "[deleted]" if you plan to remove the message on clients.
    // If you prefer to keep text as "[deleted]" for auditing, you can set it here. For now we leave text unchanged.

    await this.messageRepo.save(message);

    // Ensure gateway has access to conversation with members
    const conversation = message.conversation;
    // If conversation doesn't have members loaded, fetch it.
    if (
      !conversation ||
      !conversation.members ||
      conversation.members.length === 0
    ) {
      const conv: any = await this.convRepo.findOne({
        where: { id: message.conversation?.id },

        relations: ['members', 'members.user'],
      });
      await (this.gateway as ChatGateway).publishDelete(
        message,
        conv ?? undefined,
      );
    } else {
      await (this.gateway as ChatGateway).publishDelete(message, conversation);
    }
  }

  async deleteMessages(userId: number, messageId: string): Promise<void> {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: ['author'],
    });
    if (!message) throw new NotFoundException('Message not found');
    // if (message.author.id !== userId)
    //   throw new ForbiddenException('Cannot delete others’ messages');

    message.deletedAt = new Date();
    message.text = '[deleted]';
    // await this.messageRepo.save(message);
    (this.gateway as ChatGateway).publishDelete(message, message.conversation);

    await this.messageRepo.save(message);
  }

  async getUserDMsWithUnread(userId: number) {
    const dms = await this.convRepo.find({
      where: { type: ConversationType.DM, members: { user: { id: userId } } },
      relations: [
        'members',
        'members.user',
        'lastMessage',
        'lastMessage.author',
      ],
      order: { updatedAt: 'DESC' },
    });

    const result = await Promise.all(
      dms.map(async (dm) => {
        const readState = await this.messageReadRepo.findOne({
          where: { conversation: { id: dm.id }, user: { id: userId } },
        });

        const unreadCount = await this.messageRepo.count({
          where: {
            conversation: { id: dm.id },
            createdAt: MoreThan(readState?.updatedAt ?? new Date(0)),
          },
        });

        return {
          ...dm,
          unreadCount,
        };
      }),
    );

    return result;
  }
  async getReplies(messageId: string) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: [
        'author',
        'replies',
        'replies.author',
        'replies.attachments',
        'replies.reactions',
      ],
    });

    if (!message) throw new NotFoundException('Message not found');

    return {
      parent: message,
      replies: message.replies,
    };
  }

  // src/chat/chat.service.ts
  // src/chat/chat.service.ts
  // src/chat/chat.service.ts
  async replyToMessage(
    userId: number,
    parentMessageId: string,
    text: string,
    files?: Express.Multer.File[],
  ) {
    const parent = await this.messageRepo.findOne({
      where: { id: parentMessageId },
      relations: [
        'conversation',
        'conversation.members',
        'conversation.members.user',
      ],
    });
    if (!parent) throw new NotFoundException('Parent message not found');

    const author = await this.staffRepo.findOne({ where: { id: userId } });
    if (!author) throw new NotFoundException('User not found');

    const conversation = parent.conversation;

    // Ensure sender is a member
    const isMember = conversation.members.some((m) => m.user.id === userId);
    if (!isMember)
      throw new BadRequestException(
        'You are not a member of this conversation',
      );

    // Create reply
    const reply = this.messageRepo.create({
      conversation,
      author,
      parent,
      text,
      edited: false,
      pinned: false,
    });

    let savedReply = await this.messageRepo.save(reply);

    let savedAttachments: Attachment[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        const s3File = file as Express.Multer.File & { location?: string };
        const attachment = this.attachmentRepo.create({
          message: { id: savedReply.id },
          url: s3File.location,
          filename: s3File.originalname,
          size: s3File.size,
          mimeType: s3File.mimetype,
          provider: 's3',
        });
        const savedAttachment = await this.attachmentRepo.save(attachment);
        savedAttachments.push(savedAttachment);
      }
    }

    savedReply.attachments = savedAttachments;

    // Reload full reply with relations
    const fullReply = await this.messageRepo.findOne({
      where: { id: savedReply.id },
      relations: ['author', 'parent', 'attachments', 'reactions'],
    });

    // Update conversation metadata
    conversation.lastMessage = fullReply!;
    conversation.lastMessageAt = new Date();
    await this.convRepo.save(conversation);

    // WebSocket notify via gateway
    if (this.gateway?.publishMessage) {
      await (this.gateway as ChatGateway).publishMessage(
        fullReply!,
        conversation,
      );
    }

    // Extract and save mentions
    const mentionedUsernames = this.extractMentions(text || '');
    const mentionedUsers: Staff[] = [];
    for (const fullName of mentionedUsernames) {
      const [firstName, lastName] = fullName.split('-');
      const user = await this.staffRepo.findOne({
        where: { firstName, lastName },
      });
      if (user) {
        const mention = this.mentionRepo.create({ message: fullReply!, user });
        await this.mentionRepo.save(mention);
        mentionedUsers.push(user);
      }
    }

    // Update unread counts & Notify members via WebSocket and Push Notification
    await this.notifyMembers(
      conversation,
      author,
      fullReply!,
      mentionedUsers,
    );

    return fullReply;
  }

  async replyToMessages(userId: number, parentMessageId: string, text: string) {
    const parent = await this.messageRepo.findOne({
      where: { id: parentMessageId },
      relations: ['conversation'],
    });
    if (!parent) throw new NotFoundException('Parent message not found');

    const author = await this.staffRepo.findOne({ where: { id: userId } });
    if (!author) throw new NotFoundException('User not found');

    const reply = this.messageRepo.create({
      conversation: parent.conversation,
      author,
      parent,
      text,
    });

    return this.messageRepo.save(reply);
  }

  async getTotalUnreadMessagesForUser(userId: number): Promise<number> {
    // get conversation IDs first
    const conversations = await this.convRepo
      .createQueryBuilder('c')
      .leftJoin('c.members', 'cm')
      .where('cm.userId = :userId', { userId })
      .select('c.id')
      .getMany();

    const conversationIds = conversations.map((c) => c.id);
    if (!conversationIds.length) return 0;

    const totalUnread = await this.messageRepo
      .createQueryBuilder('m')
      .leftJoin(
        'message_reads',
        'mr',
        'mr."conversationId" = m."conversationId" AND mr."userId" = :userId',
        { userId },
      )
      .where('m."conversationId" IN (:...conversationIds)', { conversationIds })
      .andWhere('m."authorId" != :userId', { userId })
      .andWhere(
        new Brackets((qb) => {
          qb.where('mr."lastReadMessageId" IS NULL').orWhere(
            `m."createdAt" > (
              SELECT msg."createdAt"
              FROM "chat_messages" msg
              WHERE msg."id" = mr."lastReadMessageId"::uuid
            )`,
          );
        }),
      )
      .getCount();

    return totalUnread;
  }

  async markConversationAsRead(
    userId: number,
    conversationId: string,
  ): Promise<{ success: boolean }> {
    // get the latest message in the conversation
    const lastMessage = await this.messageRepo.findOne({
      where: { conversation: { id: conversationId } },
      order: { createdAt: 'DESC' },
    });

    if (!lastMessage) {
      return { success: true }; // no messages to mark
    }

    // check if a MessageRead entry exists for this user and conversation
    let messageRead = await this.messageReadRepo.findOne({
      where: { user: { id: userId }, conversation: { id: conversationId } },
    });

    if (!messageRead) {
      // create new entry
      messageRead = this.messageReadRepo.create({
        user: { id: userId } as Staff,
        conversation: { id: conversationId } as Conversation,
        lastReadMessageId: lastMessage.id,
      });
    } else {
      // update last read message
      messageRead.lastReadMessageId = lastMessage.id;
    }

    await this.messageReadRepo.save(messageRead);

    // Reset unread count for this member
    const member = await this.memberRepo.findOne({
      where: {
        user: { id: userId },
        conversation: { id: conversationId }
      }
    });

    if (member) {
      member.unreadCount = 0;
      await this.memberRepo.save(member);
    }

    if (this.gateway && (this.gateway as ChatGateway).publishUnreadCount) {
      await (this.gateway as ChatGateway).publishUnreadCount(userId);
    }

    return { success: true };
  }
  update(id: number, updateChatDto: UpdateChatDto) {
    return `This action updates a #${id} chat`;
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }
  // chat.service.ts
  async deleteDirectConversation(conversationId: string, userId: number) {
    const conv = await this.convRepo.findOne({
      where: { id: conversationId },
      relations: ['members', 'members.user', 'messages'],
    });

    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.type !== ConversationType.DM)
      throw new BadRequestException('Only DM conversations can be deleted');

    const member = conv.members.find((m) => m.user.id === userId);
    if (!member)
      throw new ForbiddenException('You are not a member of this DM');

    // --- Option A: User leaves the DM (recommended)
    await this.memberRepo.delete(member.id);

    // if both users left, delete conversation + messages
    const remainingMembers = await this.memberRepo.count({
      where: { conversation: { id: conversationId } },
    });

    if (remainingMembers === 0) {
      await this.convRepo.delete(conversationId);
      await this.messageRepo.delete({ conversation: { id: conversationId } });
    }

    return { success: true, message: 'DM deleted for this user' };
  }
  // chat.service.ts
  async leaveAllDMsForUser(userId: number) {
    // 1. Find all DM conversation memberships for this user
    const memberships = await this.memberRepo.find({
      where: {
        user: { id: userId },
        conversation: { type: ConversationType.DM },
      },
      relations: ['conversation'],
    });

    if (!memberships.length) {
      return { success: true, message: 'No DM conversations found for user' };
    }

    // 2. Delete all memberships for this user
    const membershipIds = memberships.map((m) => m.id);
    await this.memberRepo.delete(membershipIds);

    // 3. Optionally, delete conversations with no members left
    const convIds = memberships.map((m) => m.conversation.id);
    for (const convId of convIds) {
      const remainingMembers = await this.memberRepo.count({
        where: { conversation: { id: convId } },
      });
      if (remainingMembers === 0) {
        await this.messageRepo.delete({ conversation: { id: convId } });
        await this.convRepo.delete(convId);
      }
    }

    return {
      success: true,
      message: 'All DM conversations left for this user',
    };
  }

  async getAllConversationTotalUnreadCountForUser(
    userId: number,
  ): Promise<number> {
    // Step 1 — find conversation IDs user belongs to
    const memberConvs = await this.memberRepo
      .createQueryBuilder('cm')
      .select('cm.conversationId', 'conversationId')
      .where('cm.userId = :userId', { userId })
      .getRawMany();

    const convIds = memberConvs.map((r) => r.conversationId);
    if (convIds.length === 0) return 0;

    // Step 2 — count unread messages using a LEFT JOIN on message_reads
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .leftJoin(
        'message_reads',
        'mr',
        'mr."conversationId" = m."conversationId" AND mr."userId" = :userId',
        { userId },
      )
      .select('COUNT(m.id)', 'count')
      .where('m.authorId != :userId', { userId })
      .andWhere('m."conversationId" IN (:...convIds)', { convIds }).andWhere(`
      (
        mr."lastReadMessageId" IS NULL      -- user has never opened the chat
        OR m."createdAt" > (
          SELECT m2."createdAt"
          FROM "chat_messages" m2
          WHERE m2."id" = mr."lastReadMessageId"::uuid
        )
      )
      AND m."deletedAt" IS NULL
    `);

    const raw = await qb.getRawOne();
    return parseInt(raw.count, 10) || 0;
  }

  async getDMUnreadCounts(userId: number) {
    const conversations = await this.convRepo
      .createQueryBuilder('c')
      .leftJoin('c.members', 'm')
      .where('c.type = :type', { type: ConversationType.DM })
      .andWhere('m.user = :userId', { userId })
      .select(['c.id'])
      .getMany();

    if (conversations.length === 0) return [];

    const conversationIds = conversations.map((c) => c.id);

    // FIXED: load conversation relation using find
    const reads = await this.messageReadRepo.find({
      where: {
        user: { id: userId },
        conversation: { id: In(conversationIds) },
      },
      relations: ['conversation'],
    });

    const readMap = new Map();
    reads.forEach((r) => {
      if (r.conversation) {
        readMap.set(r.conversation.id, r.lastReadMessageId);
      }
    });

    const unreadCounts: { conversationId: string; unreadCount: number }[] = [];

    for (const cId of conversationIds) {
      const lastReadMessageId = readMap.get(cId);

      let qb = this.messageRepo
        .createQueryBuilder('msg')
        .where('msg.conversation = :cId', { cId })
        .andWhere('msg."authorId" != :userId', { userId })
        .andWhere('msg.deletedAt IS NULL');

      if (lastReadMessageId) {
        qb = qb.andWhere(
          `msg."createdAt" > (SELECT msg2."createdAt" FROM "chat_messages" msg2 WHERE msg2."id" = :lastReadMessageId::uuid)`,
          { lastReadMessageId },
        );
      }

      const count = await qb.getCount();

      unreadCounts.push({
        conversationId: cId,
        unreadCount: count,
      });
    }

    return unreadCounts;
  }

  async deleteConversation(conversationId: string, staffId: string) {
    const conversation: any = await this.convRepo.findOne({
      where: { id: conversationId },
      relations: ['createdBy', 'members', 'members.staff'],
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Only creator OR member can delete
    const isCreator = conversation.createdBy?.id === staffId;
    const isMember = conversation.members.some(
      (m) => m.staff && m.staff.id === staffId,
    );

    if (!isCreator && !isMember) {
      return false; // Forbidden
    }

    // HARD DELETE: remove children manually before deleting parent

    await this.messageRepo.delete({ conversation: { id: conversationId } });

    await this.memberRepo.delete({ conversation: { id: conversationId } });

    await this.convRepo.delete(conversationId);

    return true;
  }

  /////This section is for group conversation
  /////////Channels and group conversation
  async createConversation(dto: CreateConversationDto, creator: Staff | number) {
    const type = ConversationType.CHANNEL;

    const creatorId = typeof creator === 'object' && creator !== null ? (creator as any).id : Number(creator);
    const creatorStaff = await this.staffRepo.findOne({ where: { id: creatorId } });

    // Check if conversation with the same name already exists
    const existingConv = await this.convRepo.findOne({
      where: { name: dto.name },
    });
    if (existingConv) {
      throw new BadRequestException(
        `A conversation with the name "${dto.name}" already exists.`,
      );
    }

    const conv = this.convRepo.create({
      type: dto.type || type,
      name: dto.name,
      description: dto.description,
      slug: dto.slug,
      createdBy: creatorStaff || ({ id: creatorId } as Staff),
    });
    await this.convRepo.save(conv);

    // add creator as owner
    const ownerMember = this.memberRepo.create({
      conversation: conv,
      user: creatorStaff || ({ id: creatorId } as Staff),
      role: MemberRole.OWNER,
    });
    await this.memberRepo.save(ownerMember);

    // add other members if provided
    if (dto.memberIds?.length) {
      const numericIds = dto.memberIds.map((id) => Number(id));
      const members = await this.staffRepo.find({
        where: { id: In(numericIds) },
      });
      const memberEntities = members.map((m) =>
        this.memberRepo.create({
          conversation: conv,
          user: m,
          role: MemberRole.MEMBER,
        }),
      );
      await this.memberRepo.save(memberEntities);
    }

    const savedConv = await this.convRepo.findOne({
      where: { id: conv.id },
      relations: ['members', 'members.user', 'createdBy'],
    });

    if (savedConv) {
      // Broadcast to all members so their sidebar updates in real-time
      try {
        if ((this as any).gateway?.publishChannelCreated) {
          await (this.gateway as ChatGateway).publishChannelCreated(savedConv);
        }
      } catch (wsErr) {
        console.error('Failed to broadcast publishChannelCreated:', wsErr);
      }
    }

    return savedConv;
  }
  async createConversations(dto: CreateConversationDto, creator: Staff | number) {
    const type = ConversationType.CHANNEL;
    const creatorId = typeof creator === 'object' && creator !== null ? (creator as any).id : Number(creator);
    const creatorStaff = await this.staffRepo.findOne({ where: { id: creatorId } });

    // Check if conversation with the same name already exists
    const existingConv = await this.convRepo.findOne({
      where: { name: dto.name },
    });
    if (existingConv) {
      throw new Error(
        `A conversation with the name "${dto.name}" already exists.`,
      );
    }

    // Create conversation
    const conv = this.convRepo.create({
      type,
      name: dto.name,
      description: dto.description,
      slug: dto.slug,
      createdBy: creatorStaff || ({ id: creatorId } as Staff),
    });
    await this.convRepo.save(conv);

    // Add creator as owner
    const ownerMember = this.memberRepo.create({
      conversation: conv,
      user: creatorStaff || ({ id: creatorId } as Staff),
      role: MemberRole.OWNER,
      notificationsEnabled: true,
      unreadCount: 0,
      joinedAt: new Date(),
      updatedAt: new Date(),
    });
    await this.memberRepo.save(ownerMember);

    // Add other members if provided
    if (dto.memberIds?.length) {
      const numericIds = dto.memberIds.map((id) => Number(id));
      const members = await this.staffRepo.find({
        where: { id: In(numericIds) },
      });
      const memberEntities = members.map((m) =>
        this.memberRepo.create({
          conversation: conv,
          user: m,
          role: MemberRole.MEMBER,
          notificationsEnabled: true,
          unreadCount: 0,
          joinedAt: new Date(),
          updatedAt: new Date(),
        }),
      );
      await this.memberRepo.save(memberEntities);
    }

    return this.convRepo.findOne({
      where: { id: conv.id },
      relations: ['members', 'members.user', 'createdBy'],
    });
  }

  async addMembers(conversationId: string, memberIds: (number | string)[], actor: Staff | number) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return [];
    }

    const numericIds = memberIds.map((id) => Number(id)).filter((id) => !isNaN(id));

    const existingMembers = await this.memberRepo.find({
      where: {
        conversation: { id: conversationId },
      },
      relations: ['user'],
    });

    const existingUserIds = new Set(
      existingMembers.map((m) => m.user?.id).filter((id): id is number => id !== undefined && id !== null)
    );

    const toAddIds = numericIds.filter((id) => !existingUserIds.has(id));
    if (toAddIds.length === 0) {
      return existingMembers;
    }

    const staffToAdd = await this.staffRepo.find({
      where: { id: In(toAddIds) },
    });

    if (staffToAdd.length === 0) {
      return existingMembers;
    }

    const newMembers: ConversationMember[] = staffToAdd.map((staff) =>
      this.memberRepo.create({
        conversation: conv,
        user: staff,
        role: MemberRole.MEMBER,
        notificationsEnabled: true,
        unreadCount: 0,
        joinedAt: new Date(),
        updatedAt: new Date(),
      }),
    );

    const saved = await this.memberRepo.save(newMembers);

    // Broadcast to WebSocket clients
    try {
      if ((this as any).gateway) {
        await (this.gateway as ChatGateway).publishMembersAdded(
          conversationId,
          staffToAdd,
        );
      }
    } catch (wsErr) {
      console.error('Failed to broadcast publishMembersAdded:', wsErr);
    }

    // System messages for joined members
    try {
      const actorId = typeof actor === 'object' && actor !== null ? (actor as any).id : Number(actor);
      const actorStaff = await this.staffRepo.findOne({ where: { id: actorId } });

      for (const user of staffToAdd) {
        const systemMsg = this.messageRepo.create({
          conversation: conv,
          author: actorStaff || undefined,
          text: `${user.firstName} ${user.lastName} joined the channel`,
          type: MessageType.JOIN,
        });
        const savedMsg = await this.messageRepo.save(systemMsg);
        if (this.gateway?.publishMessage) {
          const fullMsg = await this.messageRepo.findOne({
            where: { id: savedMsg.id },
            relations: ['author'],
          });
          if (fullMsg) {
            await (this.gateway as ChatGateway).publishMessage(fullMsg, conv);
          }
        }

        // Send Push Notification
        try {
          if (this.pushNotificationService) {
            await this.pushNotificationService.sendNotification(user.id, {
              title: `Channel Invitation 📣`,
              body: `You have been added to channel #${conv.name || 'Channel'}`,
              type: 'channel',
            });
          }
        } catch (pushErr) {
          console.error(`Failed to send push notification to user ${user.id}:`, pushErr);
        }

        // Send Email Notification using branded template
        try {
          if (this.mailService) {
            await this.mailService.sendChannelAddedEmail(user, conv.name || 'Channel');
          }
        } catch (mailErr) {
          console.error(`Failed to send email notification to user ${user.id}:`, mailErr);
        }
      }
    } catch (sysErr) {
      console.error('Failed to create join system message:', sysErr);
    }

    return saved;
  }


  // Get all channels
  async findAllChannels(): Promise<Conversation[]> {
    return this.convRepo.find({
      where: { type: ConversationType.CHANNEL },
      relations: ['members', 'createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  // Get a single channel by id
  async findOneChannel(id: string): Promise<Conversation | null> {
    return this.convRepo.findOne({
      where: { id, type: ConversationType.CHANNEL },
      relations: ['members', 'createdBy'],
    });
  }

  async deleteChannel(id: string): Promise<boolean> {
    const result: any = await this.convRepo.delete({
      id,
      type: ConversationType.CHANNEL,
    });
    return result.affected > 0;
  }

  async getChannelConversationsWithUnreadCounts(
    userId: number,
    search?: string,
  ) {
    try {
      // 1️⃣ Fetch all channel conversations where user is a member
      const qb = this.convRepo
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.members', 'm')
        .leftJoinAndSelect('m.user', 'u')
        .leftJoinAndSelect('c.lastMessage', 'lm')
        .leftJoinAndSelect('lm.author', 'lma')
        .where('c.type = :type', { type: ConversationType.CHANNEL })
        // Ensure current user is a member
        .andWhere((qb) => {
          const sub = qb
            .subQuery()
            .select('1')
            .from('conversation_members', 'cm')
            .where('cm."conversationId" = c.id')
            .andWhere('cm."userId" = :userId')
            .getQuery();
          return `EXISTS ${sub}`;
        })
        .setParameter('userId', userId);

      // Optional search by channel name
      if (search) {
        qb.andWhere('c.name ILIKE :s', { s: `%${search}%` });
      }

      qb.orderBy('lm.createdAt', 'DESC', 'NULLS LAST');

      const conversations = await qb.getMany();

      // 2️⃣ Get unread counts from the existing function
      const unreadCounts = await this.getChannelUnreadCounts(userId);
      const unreadMap = new Map(
        unreadCounts.map((uc) => [uc.conversationId, uc.unreadCount]),
      );

      // 3️⃣ Map unreadCount into each conversation
      const conversationsWithUnread = conversations.map((c) => ({
        ...c,
        unreadCount: unreadMap.get(c.id) || 0,
      }));

      return conversationsWithUnread;
    } catch (err) {
      console.error('CHANNEL QUERY ERROR:', err);
      throw err;
    }
  }

  // src/chat/chat.service.ts
  async getChannelUnreadCounts(userId: number) {
    const conversations = await this.convRepo
      .createQueryBuilder('c')
      .leftJoin('c.members', 'm')
      .where('c.type = :type', { type: ConversationType.CHANNEL })
      .andWhere('m.user = :userId', { userId })
      .select(['c.id'])
      .getMany();

    if (conversations.length === 0) return [];

    const conversationIds = conversations.map((c) => c.id);

    const reads = await this.messageReadRepo.find({
      where: {
        user: { id: userId },
        conversation: { id: In(conversationIds) },
      },
      relations: ['conversation'],
    });

    const readMap = new Map();
    reads.forEach((r) => {
      if (r.conversation) {
        readMap.set(r.conversation.id, r.lastReadMessageId);
      }
    });

    const unreadCounts: { conversationId: string; unreadCount: number }[] = [];

    for (const cId of conversationIds) {
      const lastReadMessageId = readMap.get(cId);

      let qb = this.messageRepo
        .createQueryBuilder('msg')
        .where('msg.conversation = :cId', { cId })
        .andWhere('msg."authorId" != :userId', { userId })
        .andWhere('msg.deletedAt IS NULL');

      if (lastReadMessageId) {
        qb = qb.andWhere(
          `msg."createdAt" > (SELECT msg2."createdAt" FROM "chat_messages" msg2 WHERE msg2."id" = :lastReadMessageId::uuid)`,
          { lastReadMessageId },
        );
      }

      const count = await qb.getCount();

      unreadCounts.push({
        conversationId: cId,
        unreadCount: count,
      });
    }

    return unreadCounts;
  }

  async sendChannelMessage(
    senderId: number,
    channelId: string,
    dto: SendMessageDto,
    files?: Express.Multer.File[],
  ) {
    const sender = await this.staffRepo.findOne({ where: { id: senderId } });
    if (!sender) throw new NotFoundException('Sender not found');

    const conversation = await this.convRepo.findOne({
      where: { id: channelId, type: ConversationType.CHANNEL },
      relations: ['members', 'members.user'],
    });

    if (!conversation) throw new NotFoundException('Channel not found');

    const isMember = conversation.members.some((m) => m.user.id === sender.id);
    if (!isMember)
      throw new BadRequestException('You are not a channel member');

    // --- Create core message ---
    const message = this.messageRepo.create({
      conversation: { id: conversation.id } as Conversation,
      author: sender,
      text: dto.text ?? '',
      parent: dto.parentId ? ({ id: dto.parentId } as Message) : undefined,
    });

    let savedMessage = await this.messageRepo.save(message);

    // --- Handle attachments ---
    let savedAttachments: Attachment[] = [];
    if (files && files.length > 0) {
      for (const file of files) {
        const s3File = file as Express.Multer.File & { location?: string };

        const attachment = this.attachmentRepo.create({
          message: { id: savedMessage.id },
          url: s3File.location,
          filename: s3File.originalname,
          size: s3File.size,
          mimeType: s3File.mimetype,
          provider: 's3',
        });

        savedAttachments.push(await this.attachmentRepo.save(attachment));
      }
    }

    savedMessage.attachments = savedAttachments;

    // --- Load full message ---
    const fullMessage: any = await this.messageRepo.findOne({
      where: { id: savedMessage.id },
      relations: ['author', 'parent', 'parent.attachments', 'attachments'],
    });

    // --- Extract mentions ---
    const mentionedUsernames = this.extractMentions(dto.text || '');
    const mentionedUsers: Staff[] = [];
    for (const fullName of mentionedUsernames) {
      const [firstName, lastName] = fullName.split('-');
      const user = await this.staffRepo.findOne({
        where: { firstName, lastName },
      });
      if (user) {
        const mention = this.mentionRepo.create({ message: fullMessage, user });
        await this.mentionRepo.save(mention);
        mentionedUsers.push(user);
      }
    }

    // --- Update lastMessage ---
    conversation.lastMessage = fullMessage!;
    conversation.lastMessageAt = new Date();
    await this.convRepo.save(conversation);

    // --- WebSocket broadcast to all channel members ---
    if (this.gateway?.publishChannelMessage) {
      await this.gateway.publishChannelMessage(fullMessage!, conversation);
    } else {
      await this.gateway.publishMessage(fullMessage!, conversation);
    }

    // Update unread counts & Notify members via WebSocket and Push Notification
    await this.notifyMembers(
      conversation,
      sender,
      fullMessage!,
      mentionedUsers,
    );

    return fullMessage;
  }
  private extractMentions(text: string): string[] {
    if (!text) return [];
    // Matches @all, @name, #name, @first-last, @firstname
    const regex = /[@#]([a-zA-Z0-9_\-]+)/g;
    const usernames: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      usernames.push(match[1]);
    }
    return usernames;
  }

  private extractHashtags(text: string): string[] {
    if (!text) return [];
    const regex = /#(\w+)/g;
    const tags: any = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      tags.push(match[1]);
    }
    return tags;
  }

  async getConversationMembers(conversationId: string) {
    const members = await this.memberRepo.find({
      where: { conversation: { id: conversationId } },
      relations: ['user'],
    });

    return members;
  }
  async removeConversationMember(conversationId: string, memberId: number) {
    const member = await this.memberRepo.findOne({
      where: {
        conversation: { id: conversationId },
        user: { id: memberId },
      },
    });

    if (!member) {
      throw new NotFoundException('Member not found in conversation');
    }

    await this.memberRepo.remove(member);

    // Broadcast WebSocket event
    if ((this as any).gateway) {
      await (this.gateway as ChatGateway).publishMemberRemoved(
        conversationId,
        memberId,
      );
    }

    // System message for removed member
    const staff = await this.staffRepo.findOne({ where: { id: memberId } });
    const systemMsg = this.messageRepo.create({
      conversation: { id: conversationId } as Conversation,
      author: staff!,
      text: `${staff?.firstName} ${staff?.lastName} was removed from the channel`,
      type: MessageType.LEAVE,
    });
    const savedMsg = await this.messageRepo.save(systemMsg);
    const fullMsg = await this.messageRepo.findOne({
      where: { id: savedMsg.id },
      relations: ['author'],
    });

    const conversation = await this.convRepo.findOne({
      where: { id: conversationId },
      relations: ['members', 'members.user'],
    });
    if (this.gateway?.publishMessage) {
      await (this.gateway as ChatGateway).publishMessage(fullMsg!, conversation!);
    }

    return { message: 'Member removed successfully' };
  }

  async forwardMessage(
    senderId: number,
    messageId: string,
    targetConversationId: string,
  ) {
    const sender = await this.staffRepo.findOne({ where: { id: senderId } });
    if (!sender) throw new NotFoundException('Sender not found');

    const originalMessage = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: ['attachments'],
    });
    if (!originalMessage) throw new NotFoundException('Message not found');

    const targetConversation = await this.convRepo.findOne({
      where: { id: targetConversationId },
      relations: ['members', 'members.user'],
    });
    if (!targetConversation)
      throw new NotFoundException('Target conversation not found');

    const isMember = targetConversation.members.some(
      (m) => m.user.id === sender.id,
    );
    if (!isMember)
      throw new BadRequestException(
        'You are not a member of the target conversation',
      );

    const newMessage = this.messageRepo.create({
      conversation: targetConversation,
      author: sender,
      text: originalMessage.text,
      type: MessageType.FORWARD,
    });

    const savedMessage = await this.messageRepo.save(newMessage);

    if (originalMessage.attachments?.length) {
      for (const att of originalMessage.attachments) {
        const newAtt = this.attachmentRepo.create({
          ...att,
          id: undefined,
          message: savedMessage,
        });
        await this.attachmentRepo.save(newAtt);
      }
    }

    const fullMessage = await this.messageRepo.findOne({
      where: { id: savedMessage.id },
      relations: ['author', 'attachments'],
    });

    if (this.gateway?.publishMessage) {
      await (this.gateway as ChatGateway).publishMessage(
        fullMessage!,
        targetConversation,
      );
    }

    return fullMessage;
  }

  // --- Reaction Users List ---
  async getReactionUsers(messageId: string) {
    const reactions = await this.reactionRepo.find({
      where: { message: { id: messageId } },
      relations: ['user'],
    });

    return reactions.map((r) => ({
      id: r.id,
      emoji: r.emoji,
      createdAt: r.createdAt,
      user: {
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        avatar: r.user.photoUrl,
      },
    }));
  }

  // --- Scheduled Messages (Pumble Style Reminders) ---
  async scheduleMessage(
    senderId: number,
    dto: {
      conversationId: string;
      text: string;
      frequency: ScheduleFrequency;
      scheduledTime: string; // "HH:mm"
      dayOfWeek?: number; // 0-6
    },
  ) {
    const sender = await this.staffRepo.findOne({ where: { id: senderId } });
    if (!sender) throw new NotFoundException('Sender not found');

    const conversation = await this.convRepo.findOne({
      where: { id: dto.conversationId },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const scheduled = this.scheduledMsgRepo.create({
      conversation,
      author: sender,
      text: dto.text,
      frequency: dto.frequency || ScheduleFrequency.DAILY,
      scheduledTime: dto.scheduledTime,
      dayOfWeek: dto.dayOfWeek,
      isActive: true,
    });

    return this.scheduledMsgRepo.save(scheduled);
  }

  async getScheduledMessages(conversationId: string) {
    return this.scheduledMsgRepo.find({
      where: { conversation: { id: conversationId } },
      relations: ['author'],
      order: { createdAt: 'DESC' },
    });
  }

  async toggleScheduledMessage(id: string, userId: number) {
    const scheduled = await this.scheduledMsgRepo.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!scheduled) throw new NotFoundException('Scheduled message not found');
    if (scheduled.author.id !== userId) {
      throw new ForbiddenException('Only the author can toggle this scheduled message');
    }
    scheduled.isActive = !scheduled.isActive;
    return this.scheduledMsgRepo.save(scheduled);
  }

  async deleteScheduledMessage(id: string, userId: number) {
    const scheduled = await this.scheduledMsgRepo.findOne({
      where: { id },
      relations: ['author'],
    });
    if (!scheduled) throw new NotFoundException('Scheduled message not found');
    if (scheduled.author.id !== userId) {
      throw new ForbiddenException('Only the author can delete this scheduled message');
    }

    await this.scheduledMsgRepo.remove(scheduled);
    return { success: true };
  }

  async processScheduledMessages() {
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMinutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMinutes}`;
    const currentDay = now.getDay(); // 0 - 6

    const activeSchedules = await this.scheduledMsgRepo.find({
      where: { isActive: true },
      relations: ['conversation', 'author'],
    });

    for (const item of activeSchedules) {
      if (item.scheduledTime !== currentTimeStr) continue;

      // Check frequency rules
      if (item.frequency === ScheduleFrequency.WEEKLY && item.dayOfWeek !== currentDay) {
        continue;
      }

      // Check if already executed in the same minute
      if (item.lastRunAt) {
        const lastRun = new Date(item.lastRunAt);
        if (
          lastRun.getFullYear() === now.getFullYear() &&
          lastRun.getMonth() === now.getMonth() &&
          lastRun.getDate() === now.getDate() &&
          lastRun.getHours() === now.getHours() &&
          lastRun.getMinutes() === now.getMinutes()
        ) {
          continue;
        }
      }

      // Send the scheduled message automatically
      try {
        if (item.conversation.type === ConversationType.CHANNEL) {
          await this.sendChannelMessage(item.author.id, item.conversation.id, {
            text: `[Reminder] ${item.text}`,
          });
        } else {
          await this.sendMessages(item.author.id, {
            conversationId: item.conversation.id,
            text: `[Reminder] ${item.text}`,
          });
        }

        item.lastRunAt = now;
        if (item.frequency === ScheduleFrequency.ONCE) {
          item.isActive = false;
        }
        await this.scheduledMsgRepo.save(item);
      } catch (err) {
        console.error(`Failed executing scheduled message ${item.id}:`, err);
      }
    }
  }

  async getMessageInfo(messageId: string) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: ['conversation', 'author'],
    });

    if (!message) throw new NotFoundException('Message not found');

    const members = await this.memberRepo.find({
      where: { conversation: { id: message.conversation.id } },
      relations: ['user'],
    });

    const reads = await this.messageReadRepo.find({
      where: { conversation: { id: message.conversation.id } },
      relations: ['user'],
    });

    // Fetch the last read messages to get their creation times
    const lastReadMsgIds = reads.map((r) => r.lastReadMessageId).filter(Boolean);
    const lastReadMessages = lastReadMsgIds.length > 0
      ? await this.messageRepo.find({ where: { id: In(lastReadMsgIds) } })
      : [];

    const messageTimeMap = new Map<string, Date>();
    for (const msg of lastReadMessages) {
      messageTimeMap.set(msg.id, msg.createdAt);
    }

    const readUserIds = new Set<number>();
    for (const r of reads) {
      if (!r.user) continue;
      if (r.lastReadMessageId === message.id) {
        readUserIds.add(r.user.id);
        continue;
      }
      const lastReadTime = r.lastReadMessageId ? messageTimeMap.get(r.lastReadMessageId) : null;
      if (lastReadTime && new Date(lastReadTime).getTime() >= new Date(message.createdAt).getTime()) {
        readUserIds.add(r.user.id);
      }
    }

    const readBy: any[] = [];
    const unreadBy: any[] = [];

    for (const m of members) {
      if (!m.user) continue;
      if (m.user.id === message.author?.id) continue;

      const userInfo = {
        id: m.user.id,
        firstName: m.user.firstName || 'Staff',
        lastName: m.user.lastName || '',
        photoUrl: m.user.photoUrl || null,
      };

      if (readUserIds.has(m.user.id)) {
        readBy.push(userInfo);
      } else {
        unreadBy.push(userInfo);
      }
    }

    return {
      message: {
        id: message.id,
        text: message.text,
        createdAt: message.createdAt,
        author: message.author
          ? {
            id: message.author.id,
            firstName: message.author.firstName,
            lastName: message.author.lastName,
          }
          : null,
      },
      readBy,
      unreadBy,
    };
  }

  async getThreadConversations(userId: number) {
    const conversations = await this.convRepo
      .createQueryBuilder('c')
      .leftJoin('c.members', 'm')
      .where('m.userId = :userId', { userId })
      .getMany();

    if (conversations.length === 0) return [];

    const results: any[] = [];

    for (const conv of conversations) {
      const parentMessages = await this.messageRepo
        .createQueryBuilder('msg')
        .innerJoin('msg.repliesInThread', 'reply')
        .where('msg.conversationId = :convId', { convId: conv.id })
        .select(['msg.id', 'msg.text', 'msg.createdAt'])
        .getMany();

      if (parentMessages.length === 0) continue;

      let convUnreadCount = 0;
      const threadsInfo: any[] = [];

      for (const parent of parentMessages) {
        const threadRead = await this.threadReadRepo.findOne({
          where: {
            user: { id: userId },
            message: { id: parent.id },
          },
        });

        const lastReadAt = threadRead ? threadRead.lastReadAt : new Date(0);

        const unreadCount = await this.threadReplyRepo
          .createQueryBuilder('reply')
          .where('reply.messageId = :parentId', { parentId: parent.id })
          .andWhere('reply.createdAt > :lastReadAt', { lastReadAt })
          .andWhere('reply.authorId != :userId', { userId })
          .getCount();

        if (unreadCount > 0) {
          convUnreadCount += unreadCount;
        }

        // Get the latest reply for lastReplyAt
        const latestReply = await this.threadReplyRepo.findOne({
          where: { message: { id: parent.id } },
          order: { createdAt: 'DESC' },
        });

        threadsInfo.push({
          parentMessageId: parent.id,
          unreadCount,
          lastReplyAt: latestReply ? latestReply.createdAt : parent.createdAt,
        });
      }

      if (threadsInfo.length > 0) {
        threadsInfo.sort((a, b) => b.unreadCount - a.unreadCount || new Date(b.lastReplyAt).getTime() - new Date(a.lastReplyAt).getTime());
        const activeThreadParentId = threadsInfo[0]?.parentMessageId || null;

        const lastMsg = await this.messageRepo.findOne({
          where: { conversation: { id: conv.id } },
          order: { createdAt: 'DESC' },
          relations: ['author'],
        });

        results.push({
          id: conv.id,
          name: conv.name ? `# ${conv.name}` : 'Unnamed Channel',
          avatar: '',
          preview: lastMsg?.text || '',
          unread: convUnreadCount,
          isChannel: conv.type === ConversationType.CHANNEL,
          activeThreadParentId,
          createdAt: threadsInfo[0]?.lastReplyAt || conv.createdAt,
        });
      }
    }

    return results;
  }

  async markThreadAsRead(userId: number, messageId: string) {
    let threadRead = await this.threadReadRepo.findOne({
      where: {
        user: { id: userId },
        message: { id: messageId },
      },
    });

    if (!threadRead) {
      threadRead = this.threadReadRepo.create({
        user: { id: userId } as Staff,
        message: { id: messageId } as Message,
      });
    }

    threadRead.lastReadAt = new Date();
    await this.threadReadRepo.save(threadRead);

    if (this.gateway && (this.gateway as ChatGateway).publishUnreadCount) {
      await (this.gateway as ChatGateway).publishUnreadCount(userId);
    }

    return { success: true };
  }

  async getMessage(messageId: string) {
    const msg = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: ['author', 'attachments', 'parent', 'parent.attachments'],
    });
    if (!msg) throw new NotFoundException('Message not found');
    return msg;
  }
}
