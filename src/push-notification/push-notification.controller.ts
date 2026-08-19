import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
  BadRequestException,
  Logger,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PushNotificationService } from './push-notification.service';
import { CreatePushNotificationDto } from './dto/create-push-notification.dto';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';
import { PushNotification } from './entities/push-notification.entity';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  staffId?: number;
}

@Controller('push-notification')
export class PushNotificationController {
  private readonly logger = new Logger(PushNotificationController.name);

  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) { }

  @Post('subscribe')
  @UseGuards(StaffAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async subscribe(
    @Body() body: CreatePushNotificationDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    success: boolean;
    data: PushNotification;
    message: string;
  }> {
    try {
      const userId = req.staffId;

      // Validate staffId exists and is valid
      if (!userId || !Number.isInteger(userId) || userId <= 0) {
        this.logger.warn(`Invalid staffId in token: ${userId}`);
        throw new BadRequestException('Invalid authentication information');
      }

      this.logger.debug(`Processing subscription for user ${userId}`);

      const subscription = await this.pushNotificationService.saveSubscription(
        body,
        userId,
      );

      return {
        success: true,
        data: subscription,
        message: 'Push notification subscription created successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to subscribe user: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get()
  findAll() {
    return this.pushNotificationService.getAll();
  }

  @Get('user/all')
  @UseGuards(StaffAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getByUser(@Req() req: AuthenticatedRequest): Promise<{
    success: boolean;
    data: PushNotification[];
    count: number;
  }> {
    try {
      const userId = req.staffId;

      if (!userId || !Number.isInteger(userId) || userId <= 0) {
        this.logger.warn(`Invalid staffId in token: ${userId}`);
        throw new BadRequestException('Invalid authentication information');
      }

      this.logger.debug(`Retrieving subscriptions for user ${userId}`);

      const subscriptions =
        await this.pushNotificationService.getByUser(userId);

      return {
        success: true,
        data: subscriptions,
        count: subscriptions.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve user subscriptions: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get(':id')
  @UseGuards(StaffAuthGuard)
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    success: boolean;
    data: PushNotification;
  }> {
    try {
      if (!id || typeof id !== 'string') {
        throw new BadRequestException('Invalid subscription ID');
      }

      const subscription = await this.pushNotificationService.getById(id);

      // Verify ownership - user can only view their own subscriptions
      if (subscription.userId !== req.staffId) {
        this.logger.warn(
          `Unauthorized access attempt: User ${req.staffId} tried to access subscription of user ${subscription.userId}`,
        );
        throw new BadRequestException('Unauthorized access');
      }

      return {
        success: true,
        data: subscription,
      };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve subscription ${id}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Delete('unsubscribe/all')
  @UseGuards(StaffAuthGuard)
  @HttpCode(HttpStatus.OK)
  async unsubscribeAll(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const userId = req.staffId;

      if (!userId || !Number.isInteger(userId) || userId <= 0) {
        this.logger.warn(`Invalid staffId in token: ${userId}`);
        throw new BadRequestException('Invalid authentication information');
      }

      await this.pushNotificationService.deleteByUser(userId);

      this.logger.log(`All subscriptions deleted for user ${userId}`);
      return {
        success: true,
        message: 'All push subscriptions deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to unsubscribe all: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Delete('unsubscribe/:id')
  @UseGuards(StaffAuthGuard)
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: boolean; message: string }> {
    try {
      if (!id || typeof id !== 'string') {
        throw new BadRequestException('Invalid subscription ID');
      }

      // Verify ownership before deletion
      const subscription = await this.pushNotificationService.getById(id);
      if (subscription.userId !== req.staffId) {
        this.logger.warn(
          `Unauthorized deletion attempt: User ${req.staffId} tried to delete subscription of user ${subscription.userId}`,
        );
        throw new BadRequestException('Unauthorized access');
      }

      await this.pushNotificationService.deleteById(id);

      this.logger.log(`Subscription ${id} unsubscribed by user ${req.staffId}`);
      return {
        success: true,
        message: 'Push notification subscription deleted successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to unsubscribe: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete('admin/all')
  @HttpCode(HttpStatus.OK)
  async deleteAllSubscriptions(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      this.logger.warn('Admin endpoint called: Deleting all subscriptions');
      await this.pushNotificationService.deleteAll();
      return {
        success: true,
        message: 'All push notifications deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete all subscriptions: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
