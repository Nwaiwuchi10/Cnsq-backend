import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Query,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import {
  CreateNotificationDto,
  ListNotificationsDto,
  MarkNotificationReadDto,
} from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';

@Controller('notification')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.create(createNotificationDto);
  }
  // GET /notifications?recipientId=123&onlyUnread=true
  @Get('all/notice')
  async list(@Query() query: ListNotificationsDto) {
    const recipientId = query.recipientId;
    if (!recipientId) {
      // In a real app you'd use the auth user instead of requiring recipientId
      return [];
    }
    return this.notificationService.findForRecipient(
      recipientId,
      !!query.onlyUnread,
    );
  }

  // PATCH /notifications/:id/read  { "isRead": true }
  @Patch(':id/read')
  async markRead(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: MarkNotificationReadDto,
  ) {
    return this.notificationService.markAsRead(id, body.isRead ?? true);
  }
  @Get()
  findAll() {
    return this.notificationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.notificationService.findOne(+id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateNotificationDto: UpdateNotificationDto,
  ) {
    return this.notificationService.update(+id, updateNotificationDto);
  }

  @Delete(':id')
  @UseGuards(StaffAuthGuard)
  remove(@Param('id') id: string, @Req() req) {
    const staffId = req.staffId;
    return this.notificationService.remove(+id, staffId);
  }

  @Get('unread-count/recipient')
  @UseGuards(StaffAuthGuard)
  async getUnreadCount(@Req() req) {
    const recipientId = req.staffId;
    const count = await this.notificationService.getUnreadCount(recipientId);
    return { recipientId, unreadCount: count };
  }

  @Get('read-count/recipient')
  @UseGuards(StaffAuthGuard)
  async getReadCount(@Req() req) {
    const recipientId = req.staffId;
    const count = await this.notificationService.getReadCount(recipientId);
    return { recipientId, readCount: count };
  }

  @Get('counts/special')
  @UseGuards(StaffAuthGuard)
  async getSpecialNotificationCounts(@Req() req) {
    const recipientId = req.staffId;
    const counts =
      await this.notificationService.getProductDemoAnnouncementCounts(
        recipientId,
      );
    return {
      recipientId,
      ...counts,
    };
  }
  @Get('special/notice')
  async getSpecialNotices(@Query() query: ListNotificationsDto) {
    const recipientId = query.recipientId;
    if (!recipientId) {
      return [];
    }

    return this.notificationService.findAnnouncementNoticesForRecipient(
      recipientId,
      !!query.onlyUnread,
    );
  }
}
