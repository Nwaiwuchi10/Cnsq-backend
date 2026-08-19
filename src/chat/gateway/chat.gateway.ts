// src/chat/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

import * as jwt from 'jsonwebtoken'; // if using JWT; else adapt
import { ChatService } from '../chat.service';
import { Message } from '../entities/Message.entity';
import { ThreadReply } from '../entities/thread-reply.entity';
import { Conversation } from '../entities/conversation.entity';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { StaffRegisterService } from 'src/staff-register/staff-register.service';
import { MemberActivityService } from 'src/member-activity/member-activity.service';

@WebSocketGateway({
  cors: { origin: '*' }, // tighten origins in prod
  namespace: '/chat',
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
  private logger = new Logger('ChatGateway');

  // in-memory maps (no Redis)
  private userSockets = new Map<number, Set<string>>(); // userId -> Set(socketId)
  private socketToUser = new Map<string, number>(); // socketId -> userId

  constructor(
    @InjectRepository(Conversation) private convRepo: Repository<Conversation>,
    @InjectRepository(Message) private msgRepo: Repository<Message>,
    private readonly chatService: ChatService,
    private readonly staffService: StaffRegisterService,
    private readonly activityService: MemberActivityService,
  ) {
    // optional: wire service back-reference so service can call gateway.publishMessage
    (this.chatService as any).gateway = this;
  }

  async handleConnection(client: Socket) {
    try {
      // Example JWT auth from handshake query: ?token=...
      const token = client.handshake.query?.token as string;
      if (!token) {
        client.disconnect(true);
        return;
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        this.logger.error('JWT_SECRET is missing from environment variables');
        client.disconnect(true);
        return;
      }

      const payload = jwt.verify(token, secret) as any;

      const userId = payload.staffId || payload.sub || payload.id;
      if (!userId) {
        client.disconnect(true);
        return;
      }

      // store mapping
      const sockets = this.userSockets.get(userId) || new Set();
      const isFirstConnection = sockets.size === 0;
      sockets.add(client.id);
      this.userSockets.set(userId, sockets);
      this.socketToUser.set(client.id, userId);

      // optionally join a room named by userId for easy emission
      client.join(`user:${userId}`);

      // Emit current online users list to the new connection*
      const onlineIds = Array.from(this.userSockets.keys());
      client.emit('staff:online-list', onlineIds);

      if (isFirstConnection) {
        // Update DB status
        await this.staffService.updateOnlineStatus(userId, true);
        // Log activity
        await this.activityService.logActivity(userId, 'Staff went Online');
        // Broadcast status
        this.server.emit('staff:online', { userId });
      }

      this.logger.log(`Client connected: ${client.id} (user ${userId})`);
    } catch (err) {
      this.logger.warn(`Socket auth failed: ${err.message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.socketToUser.get(client.id);
    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
          // Update DB status
          await this.staffService.updateOnlineStatus(userId, false);
          // Log activity
          await this.activityService.logActivity(userId, 'Staff went Offline');
          // Broadcast status
          this.server.emit('staff:offline', { userId });
        }
      }
      this.socketToUser.delete(client.id);
      this.logger.log(`Client disconnected: ${client.id} (user ${userId})`);
    }
  }

  /**
   * publishMessage is called by ChatService after saving a message.
   * It emits to all members of the conversation.
   */
  async publishMessage(message: Message, conversation: Conversation) {
    // Load members if not present
    if (!conversation.members || !conversation.members.length) {
      const conv = await this.convRepo.findOne({
        where: { id: conversation.id },
        relations: ['members', 'members.user'],
      });
      if (conv) conversation = conv;
    }

    const payload = {
      id: message.id,
      conversationId: conversation.id,
      type: conversation.type,
      authorId: message.author.id,

      author: {
        id: message.author.id,
        firstName: message.author.firstName,
        lastName: message.author.lastName,
        avatar: message.author.photoUrl, // optional
      },

      text: message.text,
      messageType: message.type,
      createdAt: message.createdAt,

      attachments: message.attachments || [],
      parent: message.parent
        ? { id: message.parent.id, text: message.parent.text }
        : null,
      // attachments, reactions, etc. add as needed
    };

    // emit to each member's user room
    for (const m of conversation.members) {
      const uid = m.user.id;
      this.server.to(`user:${uid}`).emit('message:new', payload);
    }
  }
  async publishChannelMessage(message: Message, conversation: Conversation) {
    // Load members if not present
    if (!conversation.members || !conversation.members.length) {
      const conv = await this.convRepo.findOne({
        where: { id: conversation.id },
        relations: ['members', 'members.user'],
      });
      if (conv) conversation = conv;
    }

    const payload = {
      id: message.id,
      conversationId: conversation.id,
      type: conversation.type,
      authorId: message.author.id,

      author: {
        id: message.author.id,
        firstName: message.author.firstName,
        lastName: message.author.lastName,
        avatar: message.author.photoUrl, // optional
      },

      text: message.text,
      messageType: message.type,
      createdAt: message.createdAt,

      attachments: message.attachments || [],
      parent: message.parent
        ? { id: message.parent.id, text: message.parent.text }
        : null,
      // attachments, reactions, etc. add as needed
    };

    // emit to each member's user room
    for (const m of conversation.members) {
      const uid = m.user.id;
      this.server.to(`user:${uid}`).emit('message:channelnew', payload);
    }
    // Also emit to channel room
    this.server.to(`conversation:${conversation.id}`).emit('message:channelnew', payload);
  }
  async publishEdit(message: Message, conversation: Conversation) {
    const payload = {
      id: message.id,
      text: message.text,
      edited: message.edited,
    };
    for (const m of conversation.members) {
      this.server.to(`user:${m.user.id}`).emit('message:edit', payload);
    }
    this.server
      .to(`conversation:${conversation.id}`)
      .emit('message:edit', payload);
  }
  async publishDelete(message: Message, conversation?: Conversation) {
    // If conversation was not provided or members not loaded, fetch it
    if (
      !conversation ||
      !conversation.members ||
      conversation.members.length === 0
    ) {
      try {
        const conv = await this.convRepo.findOne({
          where: { id: message.conversation?.id || conversation?.id },
          relations: ['members', 'members.user'],
        });
        conversation = conv ?? conversation;
      } catch (err) {
        this.logger.error(
          `Failed to load conversation for publishDelete: ${err.message}`,
        );
      }
    }

    const payload = { id: message.id, deleted: true };

    // If members exist, emit to each member's user room
    if (conversation && conversation.members && conversation.members.length) {
      for (const m of conversation.members) {
        const uid = m.user?.id;
        if (uid) this.server.to(`user:${uid}`).emit('message:delete', payload);
      }
    }

    // Also emit to conversation room (safe even if no members)
    if (conversation && conversation.id) {
      this.server
        .to(`conversation:${conversation.id}`)
        .emit('message:delete', payload);
    } else {
      // fallback: broadcast to everyone who may be listening to message deletions
      this.server.emit('message:delete', payload);
    }
  }

  async publishThreadReply(reply: ThreadReply, conversation: Conversation) {
    // Load members if not present
    if (!conversation.members || !conversation.members.length) {
      const conv = await this.convRepo.findOne({
        where: { id: conversation.id },
        relations: ['members', 'members.user'],
      });
      if (conv) conversation = conv;
    }

    const payload = {
      id: reply.id,
      messageId: reply.message.id,
      conversationId: conversation.id,
      author: {
        id: reply.author.id,
        firstName: reply.author.firstName,
        lastName: reply.author.lastName,
        avatar: reply.author.photoUrl,
      },
      text: reply.text,
      createdAt: reply.createdAt,
      attachments: reply.attachments || [],
    };

    if (conversation.members) {
      for (const m of conversation.members) {
        this.server.to(`user:${m.user.id}`).emit('thread:reply_new', payload);
      }
    }
  }

  async publishThreadReplyEdit(reply: ThreadReply, conversation: Conversation) {
    // Load members if not present
    if (!conversation.members || !conversation.members.length) {
      const conv = await this.convRepo.findOne({
        where: { id: conversation.id },
        relations: ['members', 'members.user'],
      });
      if (conv) conversation = conv;
    }

    const payload = {
      id: reply.id,
      messageId: reply.message.id,
      text: reply.text,
      edited: reply.edited,
    };

    if (conversation.members) {
      for (const m of conversation.members) {
        this.server.to(`user:${m.user.id}`).emit('thread:reply_edit', payload);
      }
    }
  }

  async publishThreadReplyDelete(replyId: string, conversation: Conversation) {
    // Load members if not present
    if (!conversation.members || !conversation.members.length) {
      const conv = await this.convRepo.findOne({
        where: { id: conversation.id },
        relations: ['members', 'members.user'],
      });
      if (conv) conversation = conv;
    }

    const payload = { id: replyId };

    if (conversation.members) {
      for (const m of conversation.members) {
        this.server.to(`user:${m.user.id}`).emit('thread:reply_delete', payload);
      }
    }
  }

  async publishPinStatus(message: Message, conversation: Conversation) {
    const payload = {
      id: message.id,
      pinned: message.pinned,
      conversationId: conversation.id,
    };

    for (const m of conversation.members) {
      this.server.to(`user:${m.user.id}`).emit('message:pin', payload);
    }
  }

  async publishReaction(data: any, conversation: Conversation) {
    const payload = {
      messageId: data.messageId,
      threadReplyId: data.threadReplyId,
      reactions: data.reactions,
      conversationId: conversation.id,
    };

    for (const m of conversation.members) {
      this.server.to(`user:${m.user.id}`).emit('message:reaction', payload);
    }
  }


  ////unread message count

  async publishUnreadCount(userId: number) {
    try {
      const total =
        await this.chatService.getAllConversationTotalUnreadCountForUser(
          userId,
        );
      this.server.to(`user:${userId}`).emit('chat:unreadCount', { total });
    } catch (err) {
      console.error('Failed to publish unread count', err);
    }
  }

  // optional manual handler for client requests
  @SubscribeMessage('chat:requestUnread')
  async handleRequestUnread(client: any, payload: any) {
    const userId = payload?.userId || client.handshake?.auth?.userId;
    if (!userId) return;
    const total =
      await this.chatService.getAllConversationTotalUnreadCountForUser(userId);
    client.emit('chat:unreadCount', { total });
  }
  // ✅ NEW: publish full DM conversations with unread counts
  async publishDMConversations(userId: number, conversations: any[]) {
    const socketId: any = this.userSockets.get(userId);
    if (socketId) {
      this.server.to(socketId).emit('dmConversationsUpdated', {
        conversations,
      });
    }
  }
  async publishConversation(conversation: Conversation) {
    // Ensure members are loaded
    if (!conversation.members || conversation.members.length === 0) {
      const conv = await this.convRepo.findOne({
        where: { id: conversation.id },
        relations: ['members', 'members.user'],
      });
      if (conv) conversation = conv;
    }

    if (!conversation) return;

    const payload = {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      slug: conversation.slug,
      lastMessage: conversation.lastMessage
        ? {
          id: conversation.lastMessage.id,
          text: conversation.lastMessage.text,
          createdAt: conversation.lastMessage.createdAt,
        }
        : null,
      members: conversation.members.map((m) => ({
        id: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        avatar: m.user.photoUrl,
        role: m.role,
      })),
      createdAt: conversation.createdAt,
    };

    // Emit to each member's personal room so they will see the new DM if currently on chat page
    for (const m of conversation.members) {
      if (m.user && m.user.id) {
        this.server.to(`user:${m.user.id}`).emit('conversation:new', payload);
      }
    }

    // Also emit to the conversation room (clients who already joined receive it)
    this.server
      .to(`conversation:${conversation.id}`)
      .emit('conversation:new', payload);
  }
  // optional: allow clients to join conversation rooms to receive full conversation events
  // server will handle 'joinConversation' event
  afterInit() {
    this.server.on('connection', (socket: Socket) => {
      socket.on('joinConversation', (convId: string) => {
        // check membership? optionally use auth info from socketToUser
        socket.join(`conversation:${convId}`);
      });
      socket.on('leaveConversation', (convId: string) => {
        socket.leave(`conversation:${convId}`);
      });
    });
  }

  //////chat gateway for channels and group conversations
  async publishChannelCreated(conversation: Conversation) {
    // Ensure members are loaded
    if (!conversation.members || conversation.members.length === 0) {
      const conv = await this.convRepo.findOne({
        where: { id: conversation.id },
        relations: ['members', 'members.user', 'createdBy'],
      });
      if (conv) conversation = conv;
    }

    const payload = {
      id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      description: conversation.description,
      slug: conversation.slug,
      members: (conversation.members || []).map((m) => ({
        id: m.user?.id,
        firstName: m.user?.firstName,
        lastName: m.user?.lastName,
        avatar: m.user?.photoUrl,
        role: m.role,
      })),
      createdAt: conversation.createdAt,
      lastMessage: null,
      unreadCount: 0,
    };

    // Emit to each member's personal room
    for (const m of conversation.members || []) {
      if (m.user?.id) {
        this.server.to(`user:${m.user.id}`).emit('channel:new', payload);
      }
    }
  }

  async publishMembersAdded(conversationId: string, newMembers: Staff[]) {
    const payload = {
      conversationId,
      members: newMembers.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        avatar: u.photoUrl,
      })),
    };

    // Notify all existing participants in this conversation
    this.server
      .to(`conversation:${conversationId}`)
      .emit('conversation:membersAdded', payload);

    // Also notify each member individually
    for (const m of newMembers) {
      this.server.to(`user:${m.id}`).emit('conversation:addedToConversation', {
        conversationId,
      });
    }
  }

  async publishMemberRemoved(conversationId: string, removedUserId: number) {
    const payload = {
      conversationId,
      removedUserId,
    };

    // Notify all remaining conversation participants
    this.server
      .to(`conversation:${conversationId}`)
      .emit('conversation:memberRemoved', payload);

    // Also notify the removed user directly
    this.server
      .to(`user:${removedUserId}`)
      .emit('conversation:removedFromConversation', {
        conversationId,
      });
  }
}
