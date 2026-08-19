import { PartialType } from '@nestjs/mapped-types';
import { CreateMessageCeoDto } from './create-message-ceo.dto';

export class UpdateMessageCeoDto extends PartialType(CreateMessageCeoDto) {}
