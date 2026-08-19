import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { CalenderService } from './calender.service';
import { CreateCalenderDto } from './dto/create-calender.dto';
import { UpdateCalenderDto } from './dto/update-calender.dto';
import { StaffAuthGuard } from 'src/staff-register/guard/staff.guard';
import { Request } from 'express';

@Controller('calender')
export class CalenderController {
  constructor(private readonly calenderService: CalenderService) {}

  @Post()
  @UseGuards(StaffAuthGuard)
  create(@Body() createCalenderDto: CreateCalenderDto, @Req() req: Request) {
    const createdBy = (req as any).staffId;
    return this.calenderService.create(createCalenderDto, createdBy);
  }

  @Get('month')
  findMonth(@Query('year') year: number, @Query('month') month: number) {
    return this.calenderService.findMonth(+year, +month);
  }

  @Get('day/:date')
  findDay(@Param('date') date: string) {
    return this.calenderService.findDay(date);
  }

  /**
   * Get calendar events for one or more staff members.
   * - If `staffIds` is omitted, returns events for the requesting user.
   * - Supports optional `year`/`month` (month view) or `date` (day view).
   *
   * Examples:
   *   GET /calender/staff?year=2026&month=3
   *   GET /calender/staff?date=2026-03-16
   *   GET /calender/staff?staffIds=1,2&year=2026&month=3
   */
  @Get('staff')
  @UseGuards(StaffAuthGuard)
  async findStaffCalendar(
    @Req() req: Request,
    @Query('staffIds') staffIds?: string,
    @Query('date') date?: string,
    @Query('year') year?: number,
    @Query('month') month?: number,
  ) {
    const userId = (req as any).staffId;

    // Parse staff IDs (comma-separated)
    const requestedStaffIds = staffIds
      ? staffIds
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((id) => !Number.isNaN(id))
      : [];

    // Always include the requesting user unless explicitly querying others only
    const uniqueStaffIds = Array.from(
      new Set([userId, ...requestedStaffIds].filter(Boolean)),
    );

    let start: Date;
    let end: Date;

    if (date) {
      start = new Date(`${date}T00:00:00`);
      end = new Date(`${date}T23:59:59`);
    } else {
      const now = new Date();
      const queryYear = year ? +year : now.getFullYear();
      const queryMonth = month ? +month : now.getMonth() + 1;
      start = new Date(queryYear, queryMonth - 1, 1);
      end = new Date(queryYear, queryMonth, 0, 23, 59, 59);
    }

    return this.calenderService.findByStaffIds(start, end, uniqueStaffIds);
  }

  @Get('attendees/available')
  @UseGuards(StaffAuthGuard)
  async getAvailableAttendees(@Req() req: Request) {
    const userId = (req as any).staffId;
    return this.calenderService.getAvailableAttendees(userId);
  }

  @Get()
  findAll() {
    return this.calenderService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.calenderService.findOne(id);
  }

  @Get(':id/recurrences')
  async getRecurrences(
    @Param('id') id: string,
    @Query('rangeStart') rangeStart: string,
    @Query('rangeEnd') rangeEnd: string,
  ) {
    const start = rangeStart ? new Date(rangeStart) : new Date();
    const end = rangeEnd
      ? new Date(rangeEnd)
      : new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000); // Default 90 days
    return this.calenderService.getRecurrenceInstances(id, start, end);
  }

  @Patch(':id')
  @UseGuards(StaffAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCalenderDto,
    @Req() req: Request,
  ) {
    const userId = (req as any).staffId;
    return this.calenderService.update(id, dto, userId);
  }

  @Delete(':id')
  @UseGuards(StaffAuthGuard)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const userId = (req as any).staffId;
    return this.calenderService.remove(id, userId);
  }
}
