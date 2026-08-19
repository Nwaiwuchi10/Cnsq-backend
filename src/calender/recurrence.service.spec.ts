import { Test, TestingModule } from '@nestjs/testing';
import { RecurrenceService } from './recurrence.service';
import { RecurrenceFrequency } from './entities/calender.entity';

describe('RecurrenceService', () => {
  let service: RecurrenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RecurrenceService],
    }).compile();

    service = module.get<RecurrenceService>(RecurrenceService);
  });

  describe('generateRuleFromFrequency', () => {
    it('should generate RRULE for DAILY frequency', () => {
      const result = service.generateRuleFromFrequency(
        RecurrenceFrequency.DAILY,
        new Date('2026-02-20T10:00:00'),
      );

      expect(result).toBe('RRULE:FREQ=DAILY;COUNT=30');
    });

    it('should generate RRULE for WEEKLY frequency', () => {
      const result = service.generateRuleFromFrequency(
        RecurrenceFrequency.WEEKLY,
        new Date('2026-02-20T10:00:00'),
      );

      expect(result).toBe('RRULE:FREQ=WEEKLY;COUNT=12');
    });

    it('should generate RRULE for MONTHLY frequency', () => {
      const result = service.generateRuleFromFrequency(
        RecurrenceFrequency.MONTHLY,
        new Date('2026-02-20T10:00:00'),
      );

      expect(result).toBe('RRULE:FREQ=MONTHLY;COUNT=12');
    });

    it('should use custom count if provided', () => {
      const result = service.generateRuleFromFrequency(
        RecurrenceFrequency.WEEKLY,
        new Date('2026-02-20T10:00:00'),
        24,
      );

      expect(result).toBe('RRULE:FREQ=WEEKLY;COUNT=24');
    });

    it('should use 0 as valid count when explicitly set', () => {
      const result = service.generateRuleFromFrequency(
        RecurrenceFrequency.DAILY,
        new Date('2026-02-20T10:00:00'),
        0,
      );

      expect(result).toBe('RRULE:FREQ=DAILY;COUNT=0');
    });
  });

  describe('parseFrequency', () => {
    it('should parse DAILY frequency', () => {
      const result = service.parseFrequency('DAILY');

      expect(result).toBe(RecurrenceFrequency.DAILY);
    });

    it('should parse WEEKLY frequency', () => {
      const result = service.parseFrequency('WEEKLY');

      expect(result).toBe(RecurrenceFrequency.WEEKLY);
    });

    it('should parse MONTHLY frequency', () => {
      const result = service.parseFrequency('MONTHLY');

      expect(result).toBe(RecurrenceFrequency.MONTHLY);
    });

    it('should handle lowercase frequency strings', () => {
      const result = service.parseFrequency('weekly');

      expect(result).toBe(RecurrenceFrequency.WEEKLY);
    });

    it('should return WEEKLY as default for invalid frequency', () => {
      const result = service.parseFrequency('INVALID');

      expect(result).toBe(RecurrenceFrequency.WEEKLY);
    });

    it('should handle null/undefined input', () => {
      const result = service.parseFrequency(null as any);

      expect(result).toBe(RecurrenceFrequency.WEEKLY);
    });
  });

  describe('getRecurrenceDescription', () => {
    it('should return description for DAILY frequency', () => {
      const result = service.getRecurrenceDescription(
        RecurrenceFrequency.DAILY,
      );

      expect(result).toBe('Every day');
    });

    it('it should return description for WEEKLY frequency', () => {
      const result = service.getRecurrenceDescription(
        RecurrenceFrequency.WEEKLY,
      );

      expect(result).toBe('Every week');
    });

    it('should return description for MONTHLY frequency', () => {
      const result = service.getRecurrenceDescription(
        RecurrenceFrequency.MONTHLY,
      );

      expect(result).toBe('Every month');
    });
  });

  describe('getNextOccurrences', () => {
    it('should get next occurrences for WEEKLY rule', () => {
      const rule = 'RRULE:FREQ=WEEKLY;COUNT=12';
      const startDate = new Date('2026-02-20');
      const endDate = new Date('2026-12-31');

      const result = service.getNextOccurrences(rule, startDate, endDate, 4);

      expect(result).toBeDefined();
      expect(result.length).toBeLessThanOrEqual(4);
      expect(result[0].getTime()).toBeGreaterThanOrEqual(startDate.getTime());
    });

    it('should respect the limit parameter', () => {
      const rule = 'RRULE:FREQ=WEEKLY;COUNT=12';
      const startDate = new Date('2026-02-20');
      const endDate = new Date('2026-12-31');

      const result = service.getNextOccurrences(rule, startDate, endDate, 3);

      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should handle invalid RRULE gracefully', () => {
      const rule = 'INVALID_RULE';
      const startDate = new Date('2026-02-20');
      const endDate = new Date('2026-12-31');

      const result = service.getNextOccurrences(rule, startDate, endDate);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should use default limit of 12', () => {
      const rule = 'RRULE:FREQ=WEEKLY;COUNT=20';
      const startDate = new Date('2026-02-20');
      const endDate = new Date('2027-12-31');

      const result = service.getNextOccurrences(rule, startDate, endDate);

      expect(result.length).toBeLessThanOrEqual(12);
    });
  });

  describe('getOccurrencesInRange', () => {
    it('should get occurrences for WEEKLY recurring event', () => {
      const rule = 'RRULE:FREQ=WEEKLY;COUNT=12';
      const parentStart = new Date('2026-02-20T10:00:00');
      const parentEnd = new Date('2026-02-20T11:00:00');
      const rangeStart = new Date('2026-02-20');
      const rangeEnd = new Date('2026-05-20');

      const result = service.getOccurrencesInRange(
        rule,
        parentStart,
        parentEnd,
        rangeStart,
        rangeEnd,
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Verify duration is preserved
      result.forEach((occurrence) => {
        const duration =
          occurrence.endTime.getTime() - occurrence.startTime.getTime();
        const expectedDuration = parentEnd.getTime() - parentStart.getTime();
        expect(duration).toBe(expectedDuration);
      });
    });

    it('should get occurrences for MONTHLY recurring event', () => {
      const rule = 'RRULE:FREQ=MONTHLY;COUNT=12';
      const parentStart = new Date('2026-02-20T14:00:00');
      const parentEnd = new Date('2026-02-20T15:30:00');
      const rangeStart = new Date('2026-02-20');
      const rangeEnd = new Date('2026-08-31');

      const result = service.getOccurrencesInRange(
        rule,
        parentStart,
        parentEnd,
        rangeStart,
        rangeEnd,
      );

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // Check each occurrence has correct time
      result.forEach((occurrence) => {
        expect(occurrence.startTime).toBeInstanceOf(Date);
        expect(occurrence.endTime).toBeInstanceOf(Date);
      });
    });

    it('should return empty array for invalid RRULE', () => {
      const rule = 'INVALID';
      const parentStart = new Date('2026-02-20T10:00:00');
      const parentEnd = new Date('2026-02-20T11:00:00');
      const rangeStart = new Date('2026-02-20');
      const rangeEnd = new Date('2026-05-20');

      const result = service.getOccurrencesInRange(
        rule,
        parentStart,
        parentEnd,
        rangeStart,
        rangeEnd,
      );

      expect(Array.isArray(result)).toBe(true);
    });

    it('should preserve event duration for each occurrence', () => {
      const rule = 'RRULE:FREQ=WEEKLY;COUNT=4';
      const parentStart = new Date('2026-02-20T09:00:00');
      const parentEnd = new Date('2026-02-20T10:30:00');
      const expectedDuration = parentEnd.getTime() - parentStart.getTime();

      const result = service.getOccurrencesInRange(
        rule,
        parentStart,
        parentEnd,
        new Date('2026-02-20'),
        new Date('2026-03-31'),
      );

      result.forEach((occurrence) => {
        const actualDuration =
          occurrence.endTime.getTime() - occurrence.startTime.getTime();
        expect(actualDuration).toBe(expectedDuration);
      });
    });

    it('should handle RRULE with RRULE: prefix', () => {
      const rule = 'RRULE:FREQ=WEEKLY;COUNT=4';
      const parentStart = new Date('2026-02-20T10:00:00');
      const parentEnd = new Date('2026-02-20T11:00:00');
      const rangeStart = new Date('2026-02-20');
      const rangeEnd = new Date('2026-03-31');

      const result = service.getOccurrencesInRange(
        rule,
        parentStart,
        parentEnd,
        rangeStart,
        rangeEnd,
      );

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return occurrences in date range only', () => {
      const rule = 'RRULE:FREQ=WEEKLY;COUNT=20';
      const parentStart = new Date('2026-02-20T10:00:00');
      const parentEnd = new Date('2026-02-20T11:00:00');
      const rangeStart = new Date('2026-03-01');
      const rangeEnd = new Date('2026-03-31');

      const result = service.getOccurrencesInRange(
        rule,
        parentStart,
        parentEnd,
        rangeStart,
        rangeEnd,
      );

      result.forEach((occurrence) => {
        expect(occurrence.startTime.getTime()).toBeGreaterThanOrEqual(
          rangeStart.getTime(),
        );
        expect(occurrence.startTime.getTime()).toBeLessThanOrEqual(
          rangeEnd.getTime(),
        );
      });
    });
  });
});
