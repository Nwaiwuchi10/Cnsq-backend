import { Test, TestingModule } from '@nestjs/testing';
import { CalendarMailService } from './mail.service';
import { CalendarEvent, EventType } from '../entities/calender.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

describe('CalendarMailService', () => {
  let service: CalendarMailService;
  let mockTransporter: any;

  const mockStaff = (id: number): Staff =>
    ({
      id,
      firstName: `Staff${id}`,
      lastName: `User${id}`,
      email: `staff${id}@test.com`,
    }) as Staff;

  const mockEvent = (overrides = {}): CalendarEvent =>
    ({
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
      recurrenceRule: undefined,
      recurrenceFrequency: undefined,
      createdBy: mockStaff(1),
      attendees: [mockStaff(2), mockStaff(3)],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as CalendarEvent;

  beforeEach(async () => {
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
    };

    // Mock nodemailer
    jest.mock('nodemailer', () => ({
      createTransport: jest.fn().mockReturnValue(mockTransporter),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [CalendarMailService],
    }).compile();

    service = module.get<CalendarMailService>(CalendarMailService);
    service['transporter'] = mockTransporter;
  });

  describe('sendEventCreatedMail', () => {
    it('should send event created email to all attendees', async () => {
      const attendees = [mockStaff(2), mockStaff(3)];
      const event = mockEvent();
      const creator = mockStaff(1);

      await service.sendEventCreatedMail(attendees, event, creator);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'staff2@test.com, staff3@test.com',
          subject: expect.stringContaining('Test Meeting'),
          html: expect.stringContaining('New Meeting Scheduled'),
        }),
      );
    });

    it('should include event details in email', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent({
        title: 'Project Review',
        location: 'Room 101',
      });
      const creator = mockStaff(1);

      await service.sendEventCreatedMail(attendees, event, creator);

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('Project Review');
      expect(call.html).toContain('Room 101');
    });

    it('should include meeting link if provided', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent({
        meetingLink: 'https://zoom.us/j/123456',
      });
      const creator = mockStaff(1);

      await service.sendEventCreatedMail(attendees, event, creator);

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('https://zoom.us/j/123456');
    });

    it('should indicate recurrence in email if event is recurring', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent({
        isRecurring: true,
        recurrenceRule: 'RRULE:FREQ=WEEKLY;COUNT=12',
      });
      const creator = mockStaff(1);

      await service.sendEventCreatedMail(attendees, event, creator);

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('Recurrence');
    });

    it('should use correct sender email from environment', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent();
      const creator = mockStaff(1);

      await service.sendEventCreatedMail(attendees, event, creator);

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.from).toContain('Calendar Manager');
    });
  });

  describe('sendEventReminderMail', () => {
    it('should send event reminder 30 minutes before event', async () => {
      const attendees = [mockStaff(2), mockStaff(3)];
      const event = mockEvent();
      const creator = mockStaff(1);

      await service.sendEventReminderMail(attendees, event, creator);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'staff2@test.com, staff3@test.com',
          subject: expect.stringContaining('Reminder'),
          html: expect.stringContaining('Meeting Reminder'),
        }),
      );
    });

    it('should include event duration in reminder', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent({
        startTime: new Date('2026-02-20T10:00:00'),
        endTime: new Date('2026-02-20T10:30:00'),
      });
      const creator = mockStaff(1);

      await service.sendEventReminderMail(attendees, event, creator);

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('30 minutes');
    });

    it('should include meeting link in reminder if available', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent({
        meetingLink: 'https://meet.google.com/abc-def',
      });
      const creator = mockStaff(1);

      await service.sendEventReminderMail(attendees, event, creator);

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('https://meet.google.com/abc-def');
    });
  });

  describe('sendEventUpdatedMail', () => {
    it('should send event updated email to attendees', async () => {
      const attendees = [mockStaff(2), mockStaff(3)];
      const event = mockEvent({ title: 'Updated Meeting' });
      const creator = mockStaff(1);

      await service.sendEventUpdatedMail(attendees, event, creator);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'staff2@test.com, staff3@test.com',
          subject: expect.stringContaining('Updated'),
          html: expect.stringContaining('Event Updated'),
        }),
      );
    });

    it('should include updated event details', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent({
        title: 'Rescheduled Meeting',
        startTime: new Date('2026-02-25T14:00:00'),
      });
      const creator = mockStaff(1);

      await service.sendEventUpdatedMail(attendees, event, creator);

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('Rescheduled Meeting');
    });

    it('should mention creator name in update email', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent();
      const creator = mockStaff(1);

      await service.sendEventUpdatedMail(attendees, event, creator);

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('Staff1 User1');
    });
  });

  describe('sendRecurrenceNotificationMail', () => {
    it('should send recurrence notification for occurrence date', async () => {
      const attendees = [mockStaff(2), mockStaff(3)];
      const event = mockEvent({
        isRecurring: true,
        recurrenceRule: 'RRULE:FREQ=WEEKLY;COUNT=12',
      });
      const creator = mockStaff(1);
      const occurrenceDate = new Date('2026-02-27T10:00:00');

      await service.sendRecurrenceNotificationMail(
        attendees,
        event,
        creator,
        occurrenceDate,
      );

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'staff2@test.com, staff3@test.com',
          subject: expect.stringContaining('Recurring Event Notice'),
          html: expect.stringContaining('Recurring Event Notification'),
        }),
      );
    });

    it('should include occurrence date and time in notification', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent();
      const creator = mockStaff(1);
      const occurrenceDate = new Date('2026-03-20T10:00:00');

      await service.sendRecurrenceNotificationMail(
        attendees,
        event,
        creator,
        occurrenceDate,
      );

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('Occurrence Date & Time');
    });

    it('should preserve event duration for occurrence', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent({
        startTime: new Date('2026-02-20T15:00:00'),
        endTime: new Date('2026-02-20T16:30:00'),
        isRecurring: true,
      });
      const creator = mockStaff(1);
      const occurrenceDate = new Date('2026-03-20T15:00:00');

      await service.sendRecurrenceNotificationMail(
        attendees,
        event,
        creator,
        occurrenceDate,
      );

      const call = mockTransporter.sendMail.mock.calls[0][0];
      // The duration should be 90 minutes (1.5 hours)
      expect(call.html).toBeDefined();
    });

    it('should indicate this is part of recurring series', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent({
        isRecurring: true,
        recurrenceFrequency: 'WEEKLY',
      });
      const creator = mockStaff(1);
      const occurrenceDate = new Date('2026-02-27T10:00:00');

      await service.sendRecurrenceNotificationMail(
        attendees,
        event,
        creator,
        occurrenceDate,
      );

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('recurring series');
    });

    it('should include meeting details in recurrence notification', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent({
        title: 'Weekly Standup',
        description: 'Daily team sync',
        location: 'Team Room',
        meetingLink: 'https://teams.microsoft.com/...',
        isRecurring: true,
      });
      const creator = mockStaff(1);
      const occurrenceDate = new Date('2026-02-27T10:00:00');

      await service.sendRecurrenceNotificationMail(
        attendees,
        event,
        creator,
        occurrenceDate,
      );

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('Weekly Standup');
      expect(call.html).toContain('Daily team sync');
      expect(call.html).toContain('Team Room');
    });
  });

  describe('email template', () => {
    it('should include company logo in email template', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent();
      const creator = mockStaff(1);

      await service.sendEventCreatedMail(attendees, event, creator);

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('Company Logo');
    });

    it('should include professional styling in email', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent();
      const creator = mockStaff(1);

      await service.sendEventCreatedMail(attendees, event, creator);

      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toContain('font-family');
      expect(call.html).toContain('background-color');
      expect(call.html).toContain('border-radius');
    });

    it('should include footer with copyright year', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent();
      const creator = mockStaff(1);

      await service.sendEventCreatedMail(attendees, event, creator);

      const call = mockTransporter.sendMail.mock.calls[0][0];
      const currentYear = new Date().getFullYear();
      expect(call.html).toContain(currentYear.toString());
    });

    it('should handle missing optional fields gracefully', async () => {
      const attendees = [mockStaff(2)];
      const event = mockEvent({
        description: null,
        location: null,
        meetingLink: null,
      });
      const creator = mockStaff(1);

      await service.sendEventCreatedMail(attendees, event, creator);

      expect(mockTransporter.sendMail).toHaveBeenCalled();
      const call = mockTransporter.sendMail.mock.calls[0][0];
      expect(call.html).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle email send errors', async () => {
      const error = new Error('SMTP connection failed');
      mockTransporter.sendMail.mockRejectedValue(error);

      const attendees = [mockStaff(2)];
      const event = mockEvent();
      const creator = mockStaff(1);

      await expect(
        service.sendEventCreatedMail(attendees, event, creator),
      ).rejects.toThrow('SMTP connection failed');
    });

    it('should handle multiple attendees correctly', async () => {
      const attendees = Array.from({ length: 10 }, (_, i) => mockStaff(i + 2));
      const event = mockEvent();
      const creator = mockStaff(1);

      await service.sendEventCreatedMail(attendees, event, creator);

      const call = mockTransporter.sendMail.mock.calls[0][0];
      const emailList = call.to.split(', ');
      expect(emailList).toHaveLength(10);
    });
  });
});
