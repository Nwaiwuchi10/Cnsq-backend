import { PartialType } from '@nestjs/mapped-types';
import { CreateCeoMessagingCenterDto } from './create-ceo-messaging-center.dto';

export class UpdateCeoMessagingCenterDto extends PartialType(CreateCeoMessagingCenterDto) {}
