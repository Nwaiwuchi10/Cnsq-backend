import { Injectable, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';

import { InjectRepository } from '@nestjs/typeorm';
import { CalendarEvent } from './entities/calender.entity';
import { RecurrenceService } from './recurrence.service';

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,
    private readonly recurrenceService: RecurrenceService,
  ) { }
  async checkConflict(
    start: Date,
    end: Date,
    staffIds: number[],
    excludeEventId?: string,
  ) {
    if (!staffIds || staffIds.length === 0) return;

    // 1. Check strict overlaps for non-recurring events
    const nonRecurringQuery = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.attendees', 'staff')
      .leftJoinAndSelect('event.createdBy', 'creator')
      .where('event.isRecurring = false')
      .andWhere('event.startTime < :end AND event.endTime > :start', { start, end })
      .andWhere('(staff.id IN (:...staffIds) OR creator.id IN (:...staffIds))', { staffIds });

    if (excludeEventId) {
      nonRecurringQuery.andWhere('event.id != :excludeEventId', { excludeEventId });
    }

    const nonRecurringConflicts = await nonRecurringQuery.getMany();

    // 2. Fetch all recurring events for these staff that might be active
    const recurringQuery = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.attendees', 'staff')
      .leftJoinAndSelect('event.createdBy', 'creator')
      .where('event.isRecurring = true')
      .andWhere('event.startTime <= :end', { end }) // Must have started before our slot ends
      .andWhere('(event.recurrenceEndDate IS NULL OR event.recurrenceEndDate >= :start)', { start }) // And must end after our slot starts
      .andWhere('(staff.id IN (:...staffIds) OR creator.id IN (:...staffIds))', { staffIds });

    if (excludeEventId) {
      recurringQuery.andWhere('event.id != :excludeEventId', { excludeEventId });
    }

    const recurringEvents = await recurringQuery.getMany();

    // Filter recurring events manually using RRULE occurrences
    const recurringConflicts = recurringEvents.filter((event) => {
      if (!event.recurrenceRule) return false;
      const occurrences = this.recurrenceService.getOccurrencesInRange(
        event.recurrenceRule,
        event.startTime,
        event.endTime,
        start,
        end,
      );
      // If any generated occurrence overlaps our slot exactly
      return occurrences.some(
        (occ) => occ.startTime < end && occ.endTime > start,
      );
    });

    let conflicts = [...nonRecurringConflicts, ...recurringConflicts];

    // Fix availability check conflict for calendar creator
    // A creator should only conflict if they are an explicit attendee, or if the event has NO attendees(personal meeting)
    conflicts = conflicts.filter(event => {
      const isAttendee = event.attendees && event.attendees.some(s => staffIds.includes(s.id));
      const isPersonalMeetingForCreator = (!event.attendees || event.attendees.length === 0) && event.createdBy && staffIds.includes(event.createdBy.id);
      return isAttendee || isPersonalMeetingForCreator;
    });



    if (conflicts.length) {
      // Identify unique staff names that are causing the conflict
      const conflictedStaffNames = new Set<string>();
      conflicts.forEach((event) => {
        // Only list creator if it's a personal meeting
        if ((!event.attendees || event.attendees.length === 0) && event.createdBy && staffIds.includes(event.createdBy.id)) {
          conflictedStaffNames.add(
            `${event.createdBy.firstName} ${event.createdBy.lastName}`,
          );
        }
        // Always list conflicting attendees
        if (event.attendees) {
          event.attendees.forEach((s) => {
            if (staffIds.includes(s.id)) {
              conflictedStaffNames.add(`${s.firstName} ${s.lastName}`);
            }
          });
        }
      });

      throw new BadRequestException(
        `Schedule conflict detected for: ${Array.from(conflictedStaffNames).join(', ')}`,
      );
    }
  }

  async checkConflicts(start: Date, end: Date, staffIds: number[]) {
    // Similarly check non-recurring
    const nonRecurringConflicts = await this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.attendees', 'staff')
      .leftJoinAndSelect('event.createdBy', 'creator')
      .where('event.isRecurring = false')
      .andWhere('event.startTime < :end AND event.endTime > :start', { start, end })
      .andWhere('(staff.id IN (:...staffIds) OR creator.id IN (:...staffIds))', { staffIds })
      .getMany();

    // Check recurring
    const recurringEvents = await this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.attendees', 'staff')
      .leftJoinAndSelect('event.createdBy', 'creator')
      .where('event.isRecurring = true')
      .andWhere('event.startTime <= :end', { end })
      .andWhere('(event.recurrenceEndDate IS NULL OR event.recurrenceEndDate >= :start)', { start })
      .andWhere('(staff.id IN (:...staffIds) OR creator.id IN (:...staffIds))', { staffIds })
      .getMany();

    const recurringConflicts = recurringEvents.filter((event) => {
      if (!event.recurrenceRule) return false;
      const occurrences = this.recurrenceService.getOccurrencesInRange(
        event.recurrenceRule,
        event.startTime,
        event.endTime,
        start,
        end,
      );
      return occurrences.some(
        (occ) => occ.startTime < end && occ.endTime > start,
      );
    });

    let conflicts = [...nonRecurringConflicts, ...recurringConflicts];

    // Fix availability check conflict for calendar creator
    conflicts = conflicts.filter(event => {
      const isAttendee = event.attendees && event.attendees.some(s => staffIds.includes(s.id));
      const isPersonalMeetingForCreator = (!event.attendees || event.attendees.length === 0) && event.createdBy && staffIds.includes(event.createdBy.id);
      return isAttendee || isPersonalMeetingForCreator;
    });


    if (conflicts.length > 0) {
      throw new BadRequestException(
        'Schedule conflict detected for one or more staff',
      );
    }
  }
}
