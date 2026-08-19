import { Injectable } from '@nestjs/common';
import { RRule, Frequency } from 'rrule';
import { RecurrenceFrequency } from './entities/calender.entity';

@Injectable()
export class RecurrenceService {
  /**
   * Generate RRULE string from frequency with optional count
   * Defaults to 12 occurrences for WEEKLY/MONTHLY and 30 for DAILY
   */
  generateRuleFromFrequency(
    frequency: RecurrenceFrequency,
    startDate: Date,
    count: number | null = null,
  ): string {
    const freqMap = {
      [RecurrenceFrequency.DAILY]: 'DAILY',
      [RecurrenceFrequency.WEEKLY]: 'WEEKLY',
      [RecurrenceFrequency.MONTHLY]: 'MONTHLY',
    };

    // Default count if not specified
    let finalCount = count;
    if (!finalCount) {
      finalCount = frequency === RecurrenceFrequency.DAILY ? 30 : 12;
    }

    return `RRULE:FREQ=${freqMap[frequency]};COUNT=${finalCount}`;
  }

  /**
   * Generate occurrences from a recurrence rule
   */
  generateOccurrences(
    rule: string,
    start: Date,
    end: Date,
    rangeStart: Date,
    rangeEnd: Date,
  ) {
    try {
      const rrule = RRule.fromString(rule.replace('RRULE:', ''));
      return rrule.between(rangeStart, rangeEnd, true).map((date) => ({
        startTime: date,
        endTime: new Date(date.getTime() + (end.getTime() - start.getTime())),
      }));
    } catch (error) {
      console.error('Error generating occurrences:', error);
      return [];
    }
  }

  /**
   * Parse frequency string to enum
   */
  parseFrequency(frequency: string): RecurrenceFrequency {
    const normalized = frequency?.toUpperCase();
    if (
      Object.values(RecurrenceFrequency).includes(
        normalized as RecurrenceFrequency,
      )
    ) {
      return normalized as RecurrenceFrequency;
    }
    return RecurrenceFrequency.WEEKLY;
  }

  /**
   * Get human-readable recurrence description
   */
  getRecurrenceDescription(frequency: RecurrenceFrequency): string {
    const descriptions = {
      [RecurrenceFrequency.DAILY]: 'Every day',
      [RecurrenceFrequency.WEEKLY]: 'Every week',
      [RecurrenceFrequency.MONTHLY]: 'Every month',
    };
    return descriptions[frequency] || 'Custom recurrence';
  }

  /**
   * Get next N occurrences of a recurring event
   */
  getNextOccurrences(
    rule: string,
    startDate: Date,
    endDate: Date,
    limit: number = 12,
  ): Date[] {
    try {
      const rrule = RRule.fromString(rule.replace('RRULE:', ''));
      return rrule.between(startDate, endDate, true).slice(0, limit);
    } catch (error) {
      console.error('Error getting next occurrences:', error);
      return [startDate];
    }
  }

  /**
   * Get occurrences within a specific date range
   */
  getOccurrencesInRange(
    rule: string,
    parentStartTime: Date,
    parentEndTime: Date,
    rangeStart: Date,
    rangeEnd: Date,
  ): Array<{ startTime: Date; endTime: Date }> {
    try {
      const rrule = RRule.fromString(rule.replace('RRULE:', ''));
      const duration = parentEndTime.getTime() - parentStartTime.getTime();

      return rrule.between(rangeStart, rangeEnd, true).map((date) => ({
        startTime: new Date(date),
        endTime: new Date(date.getTime() + duration),
      }));
    } catch (error) {
      console.error('Error getting occurrences in range:', error);
      return [];
    }
  }
}
