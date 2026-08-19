import { Test, TestingModule } from '@nestjs/testing';
import { CalenderController } from './calender.controller';
import { CalenderService } from './calender.service';
import { EventType, RecurrenceFrequency } from './entities/calender.entity';

describe('CalenderController', () => {
  let controller: CalenderController;
  let service: CalenderService;

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
    startTime: new Date('2026-02-20T10:00:00'),
    endTime: new Date('2026-02-20T11:00:00'),
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

  const mockRequest = (staffId: number = 1) =>
    ({
      staffId,
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CalenderController],
      providers: [
        {
          provide: CalenderService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            findMonth: jest.fn(),
            findDay: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            getRecurrenceInstances: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CalenderController>(CalenderController);
    service = module.get<CalenderService>(CalenderService);
  });

  describe('create', () => {
    it('should create a new event', async () => {
      const createDto = {
        title: 'Team Meeting',
        startTime: '2026-02-20T10:00:00',
        endTime: '2026-02-20T11:00:00',
        type: EventType.MEETING,
        attendees: [2, 3],
      };
      const expectedResult = mockEvent();
      const req = mockRequest(1);

      jest.spyOn(service, 'create').mockResolvedValue(expectedResult);

      const result = await controller.create(createDto, req);

      expect(result).toEqual(expectedResult);
      expect(service.create).toHaveBeenCalledWith(createDto, 1);
    });

    it('should create a recurring event', async () => {
      const createDto = {
        title: 'Weekly Team Meeting',
        startTime: '2026-02-20T10:00:00',
        endTime: '2026-02-20T11:00:00',
        type: EventType.MEETING,
        attendees: [2],
        isRecurring: true,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
      };
      const expectedResult = mockEvent({
        isRecurring: true,
        recurrenceFrequency: RecurrenceFrequency.WEEKLY,
        recurrenceRule: 'RRULE:FREQ=WEEKLY;COUNT=12',
      });
      const req = mockRequest(1);

      jest.spyOn(service, 'create').mockResolvedValue(expectedResult);

      const result = await controller.create(createDto, req);

      expect(result.isRecurring).toBe(true);
      expect(result.recurrenceFrequency).toBe(RecurrenceFrequency.WEEKLY);
    });
  });

  describe('findAll', () => {
    it('should return all events', async () => {
      const expectedResult = [
        mockEvent({ id: 'event-1' }),
        mockEvent({ id: 'event-2' }),
      ];

      jest.spyOn(service, 'findAll').mockResolvedValue(expectedResult);

      const result = await controller.findAll();

      expect(result).toEqual(expectedResult);
      expect(service.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no events exist', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a single event by id', async () => {
      const expectedResult = mockEvent();

      jest.spyOn(service, 'findOne').mockResolvedValue(expectedResult);

      const result = await controller.findOne('event-1');

      expect(result).toEqual(expectedResult);
      expect(service.findOne).toHaveBeenCalledWith('event-1');
    });

    it('should return null if event does not exist', async () => {
      jest.spyOn(service, 'findOne').mockResolvedValue(null);

      const result = await controller.findOne('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findMonth', () => {
    it('should return events for a specific month', async () => {
      const expectedResult = [mockEvent()];

      jest.spyOn(service, 'findMonth').mockResolvedValue(expectedResult);

      const result = await controller.findMonth(2026, 2);

      expect(result).toEqual(expectedResult);
      expect(service.findMonth).toHaveBeenCalledWith(2026, 2);
    });

    it('should handle string numbers from query params', async () => {
      const expectedResult = [mockEvent()];

      jest.spyOn(service, 'findMonth').mockResolvedValue(expectedResult);

      const result = await controller.findMonth('2026' as any, '2' as any);

      expect(service.findMonth).toHaveBeenCalled();
    });
  });

  describe('findDay', () => {
    it('should return events for a specific day', async () => {
      const expectedResult = [mockEvent()];

      jest.spyOn(service, 'findDay').mockResolvedValue(expectedResult);

      const result = await controller.findDay('2026-02-20');

      expect(result).toEqual(expectedResult);
      expect(service.findDay).toHaveBeenCalledWith('2026-02-20');
    });

    it('should handle different date formats', async () => {
      const expectedResult = [];

      jest.spyOn(service, 'findDay').mockResolvedValue(expectedResult);

      const result = await controller.findDay('2026-03-15');

      expect(result).toEqual(expectedResult);
    });
  });

  describe('update', () => {
    it('should update an event', async () => {
      const updateDto = { title: 'Updated Meeting' };
      const expectedResult = mockEvent({ title: 'Updated Meeting' });
      const req = mockRequest(1);

      jest.spyOn(service, 'update').mockResolvedValue(expectedResult);

      const result = await controller.update('event-1', updateDto, req);

      expect(result).toEqual(expectedResult);
      expect(service.update).toHaveBeenCalledWith('event-1', updateDto, 1);
    });

    it('should update recurrence properties', async () => {
      const updateDto = {
        isRecurring: true,
        recurrenceFrequency: RecurrenceFrequency.MONTHLY,
      };
      const expectedResult = mockEvent({
        isRecurring: true,
        recurrenceFrequency: RecurrenceFrequency.MONTHLY,
      });
      const req = mockRequest(1);

      jest.spyOn(service, 'update').mockResolvedValue(expectedResult);

      const result = await controller.update('event-1', updateDto, req);

      expect(result.isRecurring).toBe(true);
      expect(result.recurrenceFrequency).toBe(RecurrenceFrequency.MONTHLY);
    });

    it('should pass userId from request context', async () => {
      const updateDto = { title: 'Updated' };
      const req = mockRequest(42);

      jest.spyOn(service, 'update').mockResolvedValue(mockEvent());

      await controller.update('event-1', updateDto, req);

      expect(service.update).toHaveBeenCalledWith('event-1', updateDto, 42);
    });
  });

  describe('remove', () => {
    it('should delete an event', async () => {
      const expectedResult = { message: 'Delete successful' };
      const req = mockRequest(1);

      jest.spyOn(service, 'remove').mockResolvedValue(expectedResult);

      const result = await controller.remove('event-1', req);

      expect(result).toEqual(expectedResult);
      expect(service.remove).toHaveBeenCalledWith('event-1', 1);
    });

    it('should pass userId from request context', async () => {
      const req = mockRequest(99);

      jest
        .spyOn(service, 'remove')
        .mockResolvedValue({ message: 'Delete successful' });

      await controller.remove('event-1', req);

      expect(service.remove).toHaveBeenCalledWith('event-1', 99);
    });
  });

  describe('getRecurrences', () => {
    it('should get all recurrence instances with default range', async () => {
      const expectedResult = [
        mockEvent({
          startTime: new Date('2026-02-20T10:00:00'),
          isInstance: true,
        }),
        mockEvent({
          startTime: new Date('2026-02-27T10:00:00'),
          isInstance: true,
        }),
      ];

      jest
        .spyOn(service, 'getRecurrenceInstances')
        .mockResolvedValue(expectedResult);

      const result = await controller.getRecurrences(
        'event-1',
        undefined as any,
        undefined as any,
      );

      expect(result).toEqual(expectedResult);
      expect(service.getRecurrenceInstances).toHaveBeenCalled();
    });

    it('should get recurrence instances with custom date range', async () => {
      const startDate = '2026-02-20';
      const endDate = '2026-05-20';
      const expectedResult = [mockEvent({ isInstance: true })];

      jest
        .spyOn(service, 'getRecurrenceInstances')
        .mockResolvedValue(expectedResult);

      const result = await controller.getRecurrences(
        'event-1',
        startDate,
        endDate,
      );

      expect(result).toEqual(expectedResult);
      expect(service.getRecurrenceInstances).toHaveBeenCalledWith(
        'event-1',
        new Date(startDate),
        new Date(endDate),
      );
    });

    it('should handle missing end date with default range', async () => {
      const startDate = '2026-02-20';
      const expectedResult = [mockEvent({ isInstance: true })];

      jest
        .spyOn(service, 'getRecurrenceInstances')
        .mockResolvedValue(expectedResult);

      const result = await controller.getRecurrences(
        'event-1',
        startDate,
        undefined as any,
      );

      expect(service.getRecurrenceInstances).toHaveBeenCalled();
      const callArgs = (service.getRecurrenceInstances as jest.Mock).mock
        .calls[0];
      expect(callArgs[0]).toBe('event-1');
      expect(callArgs[1]).toEqual(new Date(startDate));
    });
  });
});
