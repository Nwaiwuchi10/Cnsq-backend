// src/calls/calls.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallsService } from './calls.service';
import { CallsController } from './calls.controller';
import { CallsGateway } from './calls.gateway';
import { Call } from './entities/call.entity';
import { CallParticipant } from './entities/call-participant.entity';
import { Conversation } from 'src/chat/entities/conversation.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { StaffRegisterModule } from 'src/staff-register/staff-register.module';

@Module({
  imports: [
    StaffRegisterModule,
    TypeOrmModule.forFeature([Call, CallParticipant, Conversation, Staff]),
  ],
  controllers: [CallsController],
  providers: [CallsService, CallsGateway],
  exports: [CallsService],
})
export class CallsModule {}
