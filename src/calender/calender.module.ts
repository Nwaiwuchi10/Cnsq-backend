import { Module } from '@nestjs/common';
import { CalenderService } from './calender.service';
import { CalenderController } from './calender.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from './entities/calender.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { RecurrenceService } from './recurrence.service';
import { AvailabilityService } from './availability.service';
import { CalendarMailService } from './service/mail.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarEvent, Staff]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
    }),
  ],
  controllers: [CalenderController],
  providers: [
    CalenderService,
    RecurrenceService,
    AvailabilityService,
    CalendarMailService,
  ],
})
export class CalenderModule {}
