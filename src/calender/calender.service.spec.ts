import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CalenderService } from './calender.service';
import { RecurrenceService } from './recurrence.service';
import { AvailabilityService } from './availability.service';
import { CalendarMailService } from './service/mail.service';
import {
  CalendarEvent,
  EventType,
  RecurrenceFrequency,
} from './entities/calender.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { CreateCalenderDto } from './dto/create-calender.dto';
import { UpdateCalenderDto } from './dto/update-calender.dto';

describe('CalenderService', () => {
  let service: CalenderService;
  let mockEventRepo: any;
  let mockStaffRepo: any;
  let mockRecurrenceService: any;
  let mockAvailabilityService: any;
  let mockMailService: any;

  const mockStaff = (id: number) => ({
    id,
    firstName: `Staff${id}`,
    lastName: `User${id}`,
    email: `staff${id}@test.com`,
  });

  const mockEvent = (overrides = {}) => ({
    id: 'event-1',
    title: 'Test Meeting',
    description: 'Test Description',
    startTime: new Date('2026-03-20T10:00:00'),
    endTime: new Date('2026-03-20T11:00:00'),
    location: 'Conference Room',
    meetingLink: 'https://meet.test.com',
    color: '#22c55e',
    type: EventType.MEETING,
    isRecurring: false,
    recurrenceRule: null,
    recurrenceFrequency: null,
    createdBy: mockStaff(1),
    attendees: [mockStaff(2), mockStaff(3)],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    mockEventRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findByIds: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      merge: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    mockStaffRepo = {
      findOneBy: jest.fn(),
      find: jest.fn(),
      findByIds: jest.fn(),
    };

    mockRecurrenceService = {
      generateRuleFromFrequency: jest.fn(),
      getOccurrencesInRange: jest.fn(),
      getRecurrenceDescription: jest.fn(),
    };

    mockAvailabilityService = {
      checkConflict: jest.fn(),
    };

    mockMailService = {
      sendEventCreatedMail: jest.fn().mockResolvedValue(undefined),
      sendEventUpdatedMail: jest.fn().mockResolvedValue(undefined),
      sendEventReminderMail: jest.fn().mockResolvedValue(undefined),
      sendRecurrenceNotificationMail: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalenderService,
        {
          provide: getRepositoryToken(CalendarEvent),
          useValue: mockEventRepo,
        },
        {
          provide: getRepositoryToken(Staff),
          useValue: mockStaffRepo,
        },
        {
          provide: RecurrenceService,
          useValue: mockRecurrenceService,
        },
        {
          provide: AvailabilityService,
          useValue: mockAvailabilityService,
        },
        {
          provide: CalendarMailService,
          useValue: mockMailService,
        },
      ],
    }).compile();

    service = module.get<CalenderService>(CalenderService);
  });

  describe('create', () => {
    it('should create a single event successfully', async () => {
      const createDto: CreateCalenderDto = {
        title: 'Team Meeting',
        startTime: '2026-04-20T10:00:00',
        endTime: '2026-04-20T11:00:00',
        type: EventType.MEETING,
        attendees: [2, 3],
      };

      const creator = mockStaff(1);
      const attendees = [mockStaff(2), mockStaff(3)];
      const savedEvent = mockEvent();

      mockStaffRepo.findOneBy.mockResolvedValue(creator);
      mockStaffRepo.find.mockResolvedValue(attendees);
      mockAvailabilityService.checkConflict.mockResolvedValue(undefined);
      mockEventRepo.create.mockReturnValue(savedEvent);
      mockEventRepo.save.mockResolvedValue(savedEvent);

      const result = await service.create(createDto, 1);

      expect(result).toEqual(savedEvent);
      expect(mockStaffRepo.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(mockStaffRepo.find).toHaveBeenCalled();
      expect(mockAvailabilityService.checkConflict).toHaveBeenCalled();
      expect(mockMailService.sendEventCreatedMail).toHaveBeenCalled();
    });

    it('should create a recurring event with RRULE', async () => {
      const createDto: CreateCalenderDto = {
        title: 'Weekly Team Meeting',
        startTime: '2026-04-20T10:00:00',
        endTime: '2026-04-20T11:00:00',
        type: EventType.MEETING,
        attendees: [2],
        isRecurring: true,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
      };

      const creator = mockStaff(1);
      const attendees = [mockStaff(2)];
      const savedEvent = mockEvent({
        isRecurring: true,
        recurrenceRule: 'RRULE:FREQ=WEEKLY;COUNT=12',
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
      });

      mockStaffRepo.findOneBy.mockResolvedValue(creator);
      mockStaffRepo.find.mockResolvedValue(attendees);
      mockAvailabilityService.checkConflict.mockResolvedValue(undefined);
      mockRecurrenceService.generateRuleFromFrequency.mockReturnValue(
        'RRULE:FREQ=WEEKLY;COUNT=12',
      );
      mockEventRepo.create.mockReturnValue(savedEvent);
      mockEventRepo.save.mockResolvedValue(savedEvent);

      const result = await service.create(createDto, 1);

      expect(result.isRecurring).toBe(true);
      expect(result.recurrenceRule).toBe('RRULE:FREQ=WEEKLY;COUNT=12');
      expect(
        mockRecurrenceService.generateRuleFromFrequency,
      ).toHaveBeenCalledWith(RecurrenceFrequency.WEEKLY, expect.any(Date));
    });

    it('should throw NotFoundException if creator not found', async () => {
      mockStaffRepo.findOneBy.mockResolvedValue(null);

      const createDto: CreateCalenderDto = {
        title: 'Meeting',
        startTime: '2026-04-20T10:00:00',
        endTime: '2026-04-20T11:00:00',
        type: EventType.MEETING,
        attendees: [2],
      };

      await expect(service.create(createDto, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should send email notifications on event creation', async () => {
      const createDto: CreateCalenderDto = {
        title: 'Meeting',
        startTime: '2026-04-20T10:00:00',
        endTime: '2026-04-20T11:00:00',
        type: EventType.MEETING,
        attendees: [2, 3],
      };

      const creator = mockStaff(1);
      const attendees = [mockStaff(2), mockStaff(3)];
      const savedEvent = mockEvent();

      mockStaffRepo.findOneBy.mockResolvedValue(creator);
      mockStaffRepo.find.mockResolvedValue(attendees);
      mockAvailabilityService.checkConflict.mockResolvedValue(undefined);
      mockEventRepo.create.mockReturnValue(savedEvent);
      mockEventRepo.save.mockResolvedValue(savedEvent);

      await service.create(createDto, 1);

      expect(mockMailService.sendEventCreatedMail).toHaveBeenCalledWith(
        attendees,
        savedEvent,
        creator,
      );
    });

    it('should schedule reminders for 30, 15, and 5 minutes', async () => {
      const baseTime = new Date('2026-04-20T10:00:00Z').getTime();
      jest.useFakeTimers();
      jest.setSystemTime(baseTime);

      const startTime = new Date(baseTime + 40 * 60 * 1000); // 10:40
      const endTime = new Date(baseTime + 70 * 60 * 1000); // 11:10

      const createDto: CreateCalenderDto = {
        title: 'Meeting',
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        type: EventType.MEETING,
        attendees: [2],
      };

      const creator = mockStaff(1);
      const attendees = [mockStaff(2)];
      const savedEvent = mockEvent({
        startTime: startTime,
        endTime: endTime,
      });

      mockStaffRepo.findOneBy.mockResolvedValue(creator);
      mockStaffRepo.find.mockResolvedValue(attendees);
      mockAvailabilityService.checkConflict.mockResolvedValue(undefined);
      mockEventRepo.create.mockReturnValue(savedEvent);
      mockEventRepo.save.mockResolvedValue(savedEvent);

      await service.create(createDto, 1);

      // 30 min reminder should be at 10:10 (base + 10 min)
      jest.advanceTimersByTime(10 * 60 * 1000 + 100);
      expect(mockMailService.sendEventReminderMail).toHaveBeenCalledWith(
        attendees,
        savedEvent,
        creator,
        30,
      );

      // 15 min reminder should be at 10:25 (base + 25 min, 15 min after previous)
      jest.advanceTimersByTime(15 * 60 * 1000);
      expect(mockMailService.sendEventReminderMail).toHaveBeenCalledWith(
        attendees,
        savedEvent,
        creator,
        15,
      );

      // 5 min reminder should be at 10:35 (base + 35 min, 10 min after previous)
      jest.advanceTimersByTime(10 * 60 * 1000);
      expect(mockMailService.sendEventReminderMail).toHaveBeenCalledWith(
        attendees,
        savedEvent,
        creator,
        5,
      );

      jest.useRealTimers();
    });
  });

  describe('findOne', () => {
    it('should find an event by id', async () => {
      const event = mockEvent();
      mockEventRepo.findOne.mockResolvedValue(event);

      const result = await service.findOne('event-1');

      expect(result).toEqual(event);
      expect(mockEventRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        relations: ['attendees', 'createdBy'],
      });
    });

    it('should return null if event not found', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all events', async () => {
      const events = [
        mockEvent({ id: 'event-1' }),
        mockEvent({ id: 'event-2' }),
      ];
      mockEventRepo.find.mockResolvedValue(events);

      const result = await service.findAll();

      expect(result).toEqual(events);
      expect(mockEventRepo.find).toHaveBeenCalledWith({
        relations: ['attendees', 'createdBy'],
      });
    });
  });

  describe('findMonth', () => {
    it('should find events in a specific month', async () => {
      const events = [mockEvent()];
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(events),
      };
      mockEventRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findMonth(2026, 2);

      expect(result).toEqual(events);
      expect(mockEventRepo.createQueryBuilder).toHaveBeenCalledWith('event');
    });
  });

  describe('findDay', () => {
    it('should find events for a specific day', async () => {
      const events = [mockEvent()];
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(events),
      };
      mockEventRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findDay('2026-02-20');

      expect(result).toEqual(events);
    });
  });

  describe('update', () => {
    it('should update an event successfully', async () => {
      const owner = mockStaff(1);
      const event = mockEvent({ createdBy: owner });
      const updateDto: UpdateCalenderDto = {
        title: 'Updated Meeting',
      };
      const updatedEvent = mockEvent({
        title: 'Updated Meeting',
        createdBy: owner,
      });

      mockEventRepo.findOne.mockResolvedValue(event);
      mockAvailabilityService.checkConflict.mockResolvedValue(undefined);
      mockEventRepo.save.mockResolvedValue(updatedEvent);
      mockStaffRepo.findOneBy.mockResolvedValue(owner);

      const result = await service.update('event-1', updateDto, 1);

      expect(result).toEqual(updatedEvent);
      expect(mockMailService.sendEventUpdatedMail).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not creator', async () => {
      const event = mockEvent({ createdBy: mockStaff(1) });
      mockEventRepo.findOne.mockResolvedValue(event);

      const updateDto: UpdateCalenderDto = { title: 'Updated' };

      await expect(service.update('event-1', updateDto, 999)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if event not found', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);

      const updateDto: UpdateCalenderDto = { title: 'Updated' };

      await expect(
        service.update('non-existent', updateDto, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update recurrence when provided', async () => {
      const owner = mockStaff(1);
      const event = mockEvent({ createdBy: owner, isRecurring: false });
      const updateDto: UpdateCalenderDto = {
        isRecurring: true,
        recurrenceFrequency: RecurrenceFrequency.MONTHLY,
      };
      const updatedEvent = mockEvent({
        isRecurring: true,
        recurrenceFrequency: RecurrenceFrequency.MONTHLY,
        recurrenceRule: 'RRULE:FREQ=MONTHLY;COUNT=12',
        createdBy: owner,
      });

      mockEventRepo.findOne.mockResolvedValue(event);
      mockAvailabilityService.checkConflict.mockResolvedValue(undefined);
      mockRecurrenceService.generateRuleFromFrequency.mockReturnValue(
        'RRULE:FREQ=MONTHLY;COUNT=12',
      );
      mockEventRepo.save.mockResolvedValue(updatedEvent);
      mockStaffRepo.findOneBy.mockResolvedValue(owner);

      const result = await service.update('event-1', updateDto, 1);

      expect(result.isRecurring).toBe(true);
      expect(result.recurrenceRule).toBe('RRULE:FREQ=MONTHLY;COUNT=12');
    });

    it('should merge attendees when updating', async () => {
      const owner = mockStaff(1);
      const existingAttendees = [mockStaff(2), mockStaff(3)];
      const event = mockEvent({
        createdBy: owner,
        attendees: existingAttendees,
      });
      const updateDto: UpdateCalenderDto = {
        attendees: [4],
      };
      const newAttendees = [mockStaff(4)];
      const updatedEvent = mockEvent({
        createdBy: owner,
        attendees: [...existingAttendees, mockStaff(4)],
      });

      mockEventRepo.findOne.mockResolvedValue(event);
      mockStaffRepo.find.mockResolvedValue(newAttendees);
      mockAvailabilityService.checkConflict.mockResolvedValue(undefined);
      mockEventRepo.save.mockResolvedValue(updatedEvent);
      mockStaffRepo.findOneBy.mockResolvedValue(owner);

      await service.update('event-1', updateDto, 1);

      expect(mockMailService.sendEventUpdatedMail).toHaveBeenCalled();
    });

    it('should remove attendees when provided with a reduced list', async () => {
      const owner = mockStaff(1);
      const existingAttendees = [mockStaff(2), mockStaff(3)];
      const event = mockEvent({
        createdBy: owner,
        attendees: existingAttendees,
      });
      const updateDto: UpdateCalenderDto = {
        attendees: [2], // Removed 3
      };
      const newAttendees = [mockStaff(2)];
      const updatedEvent = mockEvent({
        createdBy: owner,
        attendees: [mockStaff(2)],
      });

      mockEventRepo.findOne.mockResolvedValue(event);
      mockStaffRepo.find.mockResolvedValue(newAttendees);
      mockAvailabilityService.checkConflict.mockResolvedValue(undefined);
      mockEventRepo.save.mockResolvedValue(updatedEvent);
      mockStaffRepo.findOneBy.mockResolvedValue(owner);

      const result = await service.update('event-1', updateDto, 1);

      expect(result.attendees).toHaveLength(1);
      expect(result.attendees[0].id).toBe(2);
      expect(mockEventRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should delete an event successfully', async () => {
      const owner = mockStaff(1);
      const event = mockEvent({ createdBy: owner });
      mockEventRepo.findOne.mockResolvedValue(event);
      mockEventRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove('event-1', 1);

      expect(result).toEqual({ message: 'Delete successful' });
      expect(mockEventRepo.delete).toHaveBeenCalledWith('event-1');
    });

    it('should throw ForbiddenException if user is not creator', async () => {
      const event = mockEvent({ createdBy: mockStaff(1) });
      mockEventRepo.findOne.mockResolvedValue(event);

      await expect(service.remove('event-1', 999)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if event not found', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent', 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getRecurrenceInstances', () => {
    it('should return event instances for a recurring event', async () => {
      const event = mockEvent({
        isRecurring: true,
        recurrenceRule: 'RRULE:FREQ=WEEKLY;COUNT=12',
      });
      const occurrences = [
        {
          startTime: new Date('2026-02-20T10:00:00'),
          endTime: new Date('2026-02-20T11:00:00'),
        },
        {
          startTime: new Date('2026-02-27T10:00:00'),
          endTime: new Date('2026-02-27T11:00:00'),
        },
      ];

      mockEventRepo.findOne.mockResolvedValue(event);
      mockRecurrenceService.getOccurrencesInRange.mockReturnValue(occurrences);

      const result = await service.getRecurrenceInstances(
        'event-1',
        new Date('2026-02-20'),
        new Date('2026-03-31'),
      );

      expect(result).toHaveLength(2);
      expect(result[0].startTime).toEqual(occurrences[0].startTime);
      expect((result[0] as any).isInstance).toBe(true);
    });

    it('should return single event if not recurring', async () => {
      const event = mockEvent({ isRecurring: false });
      mockEventRepo.findOne.mockResolvedValue(event);

      const result = await service.getRecurrenceInstances(
        'event-1',
        new Date('2026-02-20'),
        new Date('2026-03-31'),
      );

      expect(result).toEqual([event]);
    });

    it('should throw NotFoundException if event not found', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getRecurrenceInstances(
          'non-existent',
          new Date('2026-02-20'),
          new Date('2026-03-31'),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
