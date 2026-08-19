// src/calls/calls.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CallsService } from './calls.service';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';

@Controller('calls')
@UseGuards(StaffAuthGuard)
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  /**
   * GET /calls/history/:conversationId
   * Get call history for a specific conversation
   */
  @Get('history/:conversationId')
  async getCallHistory(
    @Param('conversationId') conversationId: string,
    @Query('limit') limit = '20',
    @Query('offset') offset = '0',
  ) {
    const calls = await this.callsService.getCallHistory(
      conversationId,
      parseInt(limit),
      parseInt(offset),
    );
    return { calls };
  }

  /**
   * GET /calls/log
   * Get current user's full call log
   */
  @Get('log')
  async getUserCallLog(
    @Req() req: any,
    @Query('limit') limit = '30',
    @Query('offset') offset = '0',
  ) {
    const userId = req.user?.staffId || req.user?.id || req.user?.sub;
    const log = await this.callsService.getUserCallLog(
      userId,
      parseInt(limit),
      parseInt(offset),
    );
    return { log };
  }

  /**
   * GET /calls/:callId
   * Get details of a specific call
   */
  @Get(':callId')
  async getCall(@Param('callId') callId: string) {
    const call = await this.callsService.getCall(callId);
    return { call };
  }
}
