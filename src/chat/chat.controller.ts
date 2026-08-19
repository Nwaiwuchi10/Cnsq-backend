import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UploadedFiles,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import {
  AddMembersDto,
  CreateConversationDto,
} from './dto/create-conversation.dto';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';
import { StartDmDto } from './dto/start-dm.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { AWS_S3_BUCKET_NAME, s3Client } from 'src/utils/aws-s3.config';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import * as multerS3 from 'multer-s3';
import { Conversation } from './entities/conversation.entity';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations/dm')
  @UseGuards(StaffAuthGuard)
  async startDm(@Body() dto: StartDmDto, @Req() req) {
    const user = req.staffId;
    return this.chatService.findOrCreateDirectConversation(
      user,
      dto.targetUserId,
    );
  }

  @Post('messages')
  @UseGuards(StaffAuthGuard)
  @UseInterceptors(
    FilesInterceptor('file', 10, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `chat-attachments/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    }),
  )
  async sendMessage(
    @UploadedFiles() file: Express.Multer.File[],
    @Body('dto') dto: string,
    @Req() req,
  ) {
    const user = req.staffId; // from your auth guard
    let parsedDto: SendMessageDto;
    try {
      parsedDto = typeof dto === 'string' ? JSON.parse(dto) : dto;
    } catch (err) {
      throw new BadRequestException('Invalid JSON in dto field');
    }

    console.log('Parsed DTO object:', parsedDto);

    console.log('Parsed DTO:', dto);
    return this.chatService.sendMessage(user, parsedDto, file);
  }
  @Get('conversations/:conversationId/messages')
  @UseGuards(StaffAuthGuard)
  async getMessages(
    @Param('conversationId') conversationId: string,
    @Query('cursor') cursor: string,
    @Query('limit') limit: number,
    @Req() req,
  ) {
    const userId = req.staffId;
    return this.chatService.getAllMessages(
      conversationId,
      userId,
      cursor,
      limit,
    );
  }

  @Get('conversations/:conversationId/messages/view')
  @UseGuards(StaffAuthGuard)
  async getMessagesWithoutPagination(
    @Param('conversationId') conversationId: string,
    @Req() req,
  ) {
    const userId = req.staffId; // from auth guard
    return this.chatService.getAllMessagesWithoutPagination(
      conversationId,
      userId,
    );
  }

  @Get()
  findAll() {
    return this.chatService.findAll();
  }

  @Get('conversation/:id')
  findOne(@Param('id') id: string) {
    return this.chatService.findOne(id);
  }

  @Patch('messages/:messageId/edit')
  @UseGuards(StaffAuthGuard)
  async editMessage(
    @Param('messageId') messageId: string,
    @Body('text') newText: string,
    @Req() req,
  ) {
    const userId = req.staffId;
    return this.chatService.editMessage(userId, messageId, newText);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChatDto: UpdateChatDto) {
    return this.chatService.update(+id, updateChatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chatService.remove(+id);
  }

  @Get('dm/all/user/dm')
  @UseGuards(StaffAuthGuard)
  getUsesrDMs(@Req() req) {
    const userId = req.staffId;
    return this.chatService.getUserDMs(userId);
  }

  @Get('dms/all/user')
  @UseGuards(StaffAuthGuard)
  async getUserDMs(@Req() req, @Query('search') search?: string) {
    const userId = req.staffId;
    const result = await this.chatService.getDMConversationsWithUnreadCounts(
      userId,
      search,
    );
    return { currentUserId: userId, ...result };
  }

  @Delete('message/:id')
  @UseGuards(StaffAuthGuard)
  deleteMessage(@Req() req, @Param('id') messageId: string) {
    const userId = req.staffId;
    return this.chatService.deleteMessage(userId, messageId);
  }

  @Get('message/:id/replies')
  async getReplies(@Param('id') messageId: string) {
    return this.chatService.getReplies(messageId);
  }

  //  Post a reply to a message
  @Post('message/:id/reply')
  @UseGuards(StaffAuthGuard)
  @UseInterceptors(
    FilesInterceptor('file', 10, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `chat-attachments/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    }),
  )
  async replyToMessage(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req,
    @Param('id') parentMessageId: string,
    @Body() body: { text: string },
  ) {
    const userId = req.staffId;
    return this.chatService.replyToMessage(
      userId,
      parentMessageId,
      body.text,
      files,
    );
  }

  @Get('unread-total/all/conversations')
  @UseGuards(StaffAuthGuard)
  async getTotalUnread(@Req() req) {
    const userId = req.staffId;
    return this.chatService.getTotalUnreadMessagesForUser(userId);
  }

  @Get('messages/:messageId/info')
  @UseGuards(StaffAuthGuard)
  async getMessageInfo(@Param('messageId') messageId: string) {
    return this.chatService.getMessageInfo(messageId);
  }

  @Patch('mark-read/:conversationId')
  @UseGuards(StaffAuthGuard)
  async markConversationRead(
    @Param('conversationId') conversationId: string,
    @Req() req,
  ) {
    const userId = req.staffId; // logged-in staff
    return this.chatService.markConversationAsRead(userId, conversationId);
  }

  @Delete('dm/:conversationId')
  @UseGuards(StaffAuthGuard)
  async deleteDMConversation(
    @Param('conversationId') conversationId: string,
    @Req() req,
    // @StaffUser() user: Staff,
  ) {
    const userId = req.staffId;
    return this.chatService.deleteDirectConversation(conversationId, userId);
  }

  // chat.controller.ts
  @Delete('dm/all/me')
  @UseGuards(StaffAuthGuard)
  async deleteAllDMConversations(@Req() req) {
    const userId = req.staffId;
    return this.chatService.leaveAllDMsForUser(userId);
  }

  @UseGuards(StaffAuthGuard)
  @Get('unread-total/user/all/conversations')
  async getUnreadTotal(@Req() req) {
    const userId = req.staffId;
    const total =
      await this.chatService.getAllConversationTotalUnreadCountForUser(userId);
    return { total }; // frontend will read res.data.total
  }

  @Get('user/dm/unread-counts')
  @UseGuards(StaffAuthGuard)
  async getDMUnreadCounts(@Req() req) {
    const userId = req.staffId;
    return this.chatService.getDMUnreadCounts(userId);
  }

  @UseGuards(StaffAuthGuard)
  @Delete(':id/delete')
  async deleteConversation(@Param('id') id: string, @Req() req) {
    const userId = req.staffId;
    const ok = await this.chatService.deleteConversation(id, userId);

    if (!ok) {
      throw new ForbiddenException(
        'You are not allowed to delete this conversation',
      );
    }

    return { message: 'Conversation deleted successfully' };
  }

  ////Channels or group conversation management APIs below
  @Post('conversations')
  @UseGuards(StaffAuthGuard)
  async createConversation(@Body() dto: CreateConversationDto, @Req() req) {
    const user = req.staffId;
    return this.chatService.createConversation(dto, user);
  }

  @Post('conversations/:id/members')
  @UseGuards(StaffAuthGuard)
  async addMembersToConversation(
    @Param('id') id: string,
    @Body() dto: AddMembersDto,
    @Body('memberIds') bodyMemberIds: number[],
    @Req() req,
  ) {
    const user = req.staffId;
    const memberIds = dto?.memberIds || bodyMemberIds;
    return this.chatService.addMembers(id, memberIds, user);
  }

  @Post('channels/:id/members')
  @UseGuards(StaffAuthGuard)
  async addMembersToChannel(
    @Param('id') id: string,
    @Body() dto: AddMembersDto,
    @Body('memberIds') bodyMemberIds: number[],
    @Req() req,
  ) {
    const user = req.staffId;
    const memberIds = dto?.memberIds || bodyMemberIds;
    return this.chatService.addMembers(id, memberIds, user);
  }

  @Get('channels')
  async getAllChannels(): Promise<Conversation[]> {
    return this.chatService.findAllChannels();
  }

  // 2) GET single channel by id
  @Get('channels/:id')
  async getChannel(@Param('id') id: string): Promise<Conversation> {
    const channel = await this.chatService.findOneChannel(id);
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  @Delete('channels/:id')
  async deleteChannel(@Param('id') id: string): Promise<{ message: string }> {
    const deleted = await this.chatService.deleteChannel(id);
    if (!deleted)
      throw new NotFoundException('Channel not found or already deleted');
    return { message: 'Channel deleted successfully' };
  }

  @UseGuards(StaffAuthGuard) // make sure only authenticated users can access
  @Get('channels/all/user')
  async getChannels(@Req() req: any, @Query('search') search?: string) {
    const userId = req.staffId; // assuming the AuthGuard attaches user to req
    return this.chatService.getChannelConversationsWithUnreadCounts(
      userId,
      search,
    );
  }

  @Post('channels/:id/messages')
  @UseGuards(StaffAuthGuard)
  @UseInterceptors(
    FilesInterceptor('file', 10, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `chat-attachments/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async sendChannelMessage(
    @UploadedFiles() file: Express.Multer.File[],
    @Body('dto') dto: string,
    @Req() req,
    @Param('id') channelId: string,
  ) {
    const user = req.staffId;

    let parsedDto: SendMessageDto;
    try {
      parsedDto = typeof dto === 'string' ? JSON.parse(dto) : dto;
    } catch {
      throw new BadRequestException('Invalid JSON in dto field');
    }

    return this.chatService.sendChannelMessage(
      user,
      channelId,
      parsedDto,
      file,
    );
  }

  @Get('/channels/:conversationId/members')
  @UseGuards(StaffAuthGuard)
  async getMembers(@Param('conversationId') conversationId: string) {
    return this.chatService.getConversationMembers(conversationId);
  }

  @Delete('/channels/:conversationId/members/:memberId')
  @UseGuards(StaffAuthGuard)
  async removeMember(
    @Param('conversationId') conversationId: string,
    @Param('memberId') memberId: number,
  ) {
    return this.chatService.removeConversationMember(conversationId, memberId);
  }

  @Post('thread-reply')
  @UseGuards(StaffAuthGuard)
  @UseInterceptors(
    FilesInterceptor('file', 10, {
      storage: multerS3({
        s3: s3Client as any,
        bucket: AWS_S3_BUCKET_NAME,
        acl: 'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
          const sanitized = file.originalname
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9.-]/g, '');
          cb(null, `chat-attachments/${Date.now()}-${sanitized}`);
        },
      }),
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
    }),
  )
  async sendThreadReply(
    @UploadedFiles() file: Express.Multer.File[],
    @Body('messageId') messageId: string,
    @Body('text') text: string,
    @Body('parentReplyId') parentReplyId: string,
    @Req() req,
  ) {
    const user = req.staffId;
    return this.chatService.sendThreadReply(user, messageId, text, file, parentReplyId);
  }

  @Patch('thread-reply/:replyId')
  @UseGuards(StaffAuthGuard)
  async updateThreadReply(
    @Param('replyId') replyId: string,
    @Body('text') text: string,
    @Req() req,
  ) {
    const userId = req.staffId;
    return this.chatService.updateThreadReply(userId, replyId, text);
  }

  @Delete('thread-reply/:replyId')
  @UseGuards(StaffAuthGuard)
  async deleteThreadReply(@Param('replyId') replyId: string, @Req() req) {
    const userId = req.staffId;
    return this.chatService.deleteThreadReply(userId, replyId);
  }

  @Post('messages/:messageId/pin')
  @UseGuards(StaffAuthGuard)
  async togglePin(@Param('messageId') messageId: string, @Req() req) {
    const userId = req.staffId;
    return this.chatService.togglePinMessage(userId, messageId);
  }

  @Post('reaction')
  @UseGuards(StaffAuthGuard)
  async toggleReaction(
    @Body() body: { emoji: string; messageId?: string; threadReplyId?: string },
    @Req() req,
  ) {
    const userId = req.staffId;
    return this.chatService.toggleReaction(
      userId,
      body.emoji,
      body.messageId,
      body.threadReplyId,
    );
  }

  @Get('messages/:messageId/thread-replies')
  @UseGuards(StaffAuthGuard)
  async getThreadReplies(@Param('messageId') messageId: string) {
    return this.chatService.getThreadReplies(messageId);
  }

  @Get('messages/:messageId/reactions')
  @UseGuards(StaffAuthGuard)
  async getReactions(
    @Param('messageId') messageId: string,
    @Query('threadReplyId') threadReplyId?: string,
  ) {
    return this.chatService.getReactionsState(messageId, threadReplyId);
  }

  @Get('messages/:messageId/reaction-users')
  @UseGuards(StaffAuthGuard)
  async getReactionUsers(@Param('messageId') messageId: string) {
    return this.chatService.getReactionUsers(messageId);
  }

  @Post('scheduled-messages')
  @UseGuards(StaffAuthGuard)
  async scheduleMessage(@Body() dto: any, @Req() req) {
    const userId = req.staffId;
    return this.chatService.scheduleMessage(userId, dto);
  }

  @Get('scheduled-messages/conversation/:conversationId')
  @UseGuards(StaffAuthGuard)
  async getScheduledMessages(@Param('conversationId') conversationId: string) {
    return this.chatService.getScheduledMessages(conversationId);
  }

  @Patch('scheduled-messages/:id/toggle')
  @UseGuards(StaffAuthGuard)
  async toggleScheduledMessage(@Param('id') id: string, @Req() req) {
    const userId = req.staffId;
    return this.chatService.toggleScheduledMessage(id, userId);
  }

  @Delete('scheduled-messages/:id')
  @UseGuards(StaffAuthGuard)
  async deleteScheduledMessage(@Param('id') id: string, @Req() req) {
    const userId = req.staffId;
    return this.chatService.deleteScheduledMessage(id, userId);
  }

  @Get('threads/conversations')
  @UseGuards(StaffAuthGuard)
  async getThreadConversations(@Req() req) {
    const userId = req.staffId;
    return this.chatService.getThreadConversations(userId);
  }

  @Post('threads/:messageId/read')
  @UseGuards(StaffAuthGuard)
  async markThreadAsRead(@Param('messageId') messageId: string, @Req() req) {
    const userId = req.staffId;
    return this.chatService.markThreadAsRead(userId, messageId);
  }

  @Get('messages/:messageId')
  @UseGuards(StaffAuthGuard)
  async getMessage(@Param('messageId') messageId: string) {
    return this.chatService.getMessage(messageId);
  }
}
