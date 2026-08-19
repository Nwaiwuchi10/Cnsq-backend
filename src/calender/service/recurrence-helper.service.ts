import { Injectable } from '@nestjs/common';
import { RecurrenceFrequency } from '../entities/calender.entity';

@Injectable()
export class RecurrenceHelperService {
  /**
   * Generate RRULE string based on frequency
   * @param frequency DAILY, WEEKLY, or MONTHLY
   * @param startDate The start date of the event
   * @param endDate Optional end date for the recurrence
   * @returns RRULE string compatible with rrule library
   */
  generateRRule(
    frequency: RecurrenceFrequency,
    startDate: Date,
    endDate?: Date,
  ): string {
    const freqMap = {
      [RecurrenceFrequency.DAILY]: 'DAILY',
      [RecurrenceFrequency.WEEKLY]: 'WEEKLY',
      [RecurrenceFrequency.MONTHLY]: 'MONTHLY',
    };

    let rrule = `RRULE:FREQ=${freqMap[frequency]}`;

    if (endDate) {
      const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '');
      rrule += `;UNTIL=${endDateStr}`;
    }

    return rrule;
  }

  /**
   * Parse frequency label to enum
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
    return RecurrenceFrequency.WEEKLY; // default
  }

  /**
   * Get human-readable description of recurrence
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
   * Validate if recurrence dates are valid
   */
  isValidRecurrenceDates(startDate: Date, endDate?: Date): boolean {
    const now = new Date();
    if (startDate < now) {
      return false;
    }
    if (endDate && endDate <= startDate) {
      return false;
    }
    return true;
  }
}
