import {
  IsString,
  IsObject,
  IsNotEmpty,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PushSubscriptionDataDto {
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class CreatePushNotificationDto {
  @IsUrl()
  @IsNotEmpty({ message: 'endpoint must not be empty' })
  endpoint: string;

  @IsObject()
  @IsNotEmpty({ message: 'subscription keys must not be empty' })
  @ValidateNested()
  @Type(() => PushSubscriptionDataDto)
  keys: PushSubscriptionDataDto;
}
