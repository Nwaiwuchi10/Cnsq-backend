import { Module } from '@nestjs/common';
import { BirthdayService } from './birthday.service';
import { BirthdayController } from './birthday.controller';

@Module({
  controllers: [BirthdayController],
  providers: [BirthdayService],
})
export class BirthdayModule {}
