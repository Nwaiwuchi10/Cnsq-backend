import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { CreatePushNotificationDto } from './dto/create-push-notification.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushNotification } from './entities/push-notification.entity';
import * as webpush from 'web-push';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    @InjectRepository(PushNotification)
    private pushRepo: Repository<PushNotification>,
  ) {
    webpush.setVapidDetails(
      `mailto:${process.env.ADMIN_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
  }

  async saveSubscription(
    subscriptionData: CreatePushNotificationDto,
    userId: number,
  ): Promise<PushNotification> {
    try {
      // Validate userId is a positive integer
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new BadRequestException('Invalid user ID');
      }

      // Check if subscription already exists for this endpoint
      const existingSubscription = await this.pushRepo.findOne({
        where: { endpoint: subscriptionData.endpoint },
      });

      if (existingSubscription) {
        // Update existing subscription
        existingSubscription.data = subscriptionData;
        existingSubscription.userId = userId; // Sync userId to ensure correct recipient maps to push endpoint
        existingSubscription.updatedAt = new Date();
        return await this.pushRepo.save(existingSubscription);
      }

      // Create new subscription
      const pushSubscription = this.pushRepo.create({
        endpoint: subscriptionData.endpoint,
        data: subscriptionData,
        userId,
      });

      const savedSubscription = await this.pushRepo.save(pushSubscription);
      this.logger.log(`Subscription saved for user ${userId}`);
      return savedSubscription;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to save subscription for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to save subscription. Please try again.',
      );
    }
  }
  async getAll() {
    return this.pushRepo.find();
  }

  async getByUser(userId: number): Promise<PushNotification[]> {
    try {
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new BadRequestException('Invalid user ID');
      }

      const subscriptions = await this.pushRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });

      return subscriptions;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(
        `Failed to retrieve subscriptions for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve subscriptions',
      );
    }
  }

  async deleteById(id: string): Promise<void> {
    try {
      if (!id || typeof id !== 'string') {
        throw new BadRequestException('Invalid subscription ID');
      }

      // Basic UUID validation to prevent DB errors with invalid UUID strings
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        throw new BadRequestException('Invalid subscription ID format');
      }

      const subscription = await this.pushRepo.findOne({ where: { id } });

      if (!subscription) {
        throw new NotFoundException('Push subscription not found');
      }

      await this.pushRepo.remove(subscription);
      this.logger.log(`Subscription ${id} deleted successfully`);
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to delete subscription ${id}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to delete subscription');
    }
  }

  async deleteByUser(userId: number): Promise<void> {
    try {
      if (!Number.isInteger(userId) || userId <= 0) {
        throw new BadRequestException('Invalid user ID');
      }

      const result = await this.pushRepo.delete({ userId });

      if (result.affected === 0) {
        throw new NotFoundException('No subscriptions found for this user');
      }

      this.logger.log(`All subscriptions deleted for user ${userId}`);
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to delete subscriptions for user ${userId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to delete subscriptions');
    }
  }

  async getById(subscriptionId: string): Promise<PushNotification> {
    try {
      if (!subscriptionId || typeof subscriptionId !== 'string') {
        throw new BadRequestException('Invalid subscription ID');
      }

      // Basic UUID validation to prevent DB errors with invalid UUID strings
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(subscriptionId)) {
        throw new BadRequestException('Invalid subscription ID format');
      }

      const subscription = await this.pushRepo.findOne({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        throw new NotFoundException('Push subscription not found');
      }

      return subscription;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(
        `Failed to retrieve subscription ${subscriptionId}: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to retrieve subscription');
    }
  }

  /**
   * Delete all subscriptions (use with caution)
   */
  async deleteAll(): Promise<void> {
    try {
      await this.pushRepo.clear();
      this.logger.warn('All push subscriptions have been deleted');
    } catch (error) {
      this.logger.error(
        `Failed to delete all subscriptions: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to delete subscriptions');
    }
  }

  async sendNotification(
    userId: number,
    payload: { title: string; body: string; url?: string; type?: string },
  ): Promise<void> {
    const subs = await this.getByUser(userId);
    if (!subs || subs.length === 0) {
      this.logger.log(`No push subscriptions for user ${userId}`);
      return;
    }

    const jsonPayload = JSON.stringify(payload);

    await Promise.all(
      subs.map((sub) =>
        webpush.sendNotification(sub.data, jsonPayload).catch((err) => {
          this.logger.error(
            `Push failed for user ${userId}, subscription ${sub.id}`,
            err,
          );
        }),
      ),
    );
  }
}
