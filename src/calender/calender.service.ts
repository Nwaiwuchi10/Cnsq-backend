import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { CreateCalenderDto } from './dto/create-calender.dto';
import { UpdateCalenderDto } from './dto/update-calender.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { CalendarEvent } from './entities/calender.entity';
import { In, Repository } from 'typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { RecurrenceService } from './recurrence.service';
import { AvailabilityService } from './availability.service';
import { CalendarMailService } from './service/mail.service';

@Injectable()
export class CalenderService {
  constructor(
    @InjectRepository(CalendarEvent)
    private readonly eventRepo: Repository<CalendarEvent>,

    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,

    private readonly recurrenceService: RecurrenceService,
    private readonly availabilityService: AvailabilityService,
    private readonly mailService: CalendarMailService,
  ) { }

  async create(dto: CreateCalenderDto, createdByStaffId: number) {
    // Get the creator user
    const creator = await this.staffRepo.findOneBy({ id: createdByStaffId });
    if (!creator) {
      throw new NotFoundException('Creator user not found');
    }

    // Get attendees (may be undefined or empty)
    let attendees = [] as Staff[];
    if (dto.attendees && dto.attendees.length > 0) {
      attendees = await this.staffRepo.find({
        where: { id: In(dto.attendees) },
      });
    }

    // Ensure creator is not in attendees list (by id or matching email/name)
    attendees = attendees.filter((a) => {
      if (!a) return false;
      if (a.id === creator.id) return false;
      const creatorFullName = `${creator.firstName} ${creator.lastName}`.trim();
      const attendeeFullName = `${a.firstName} ${a.lastName}`.trim();
      if (
        attendeeFullName &&
        creatorFullName &&
        attendeeFullName.toLowerCase() === creatorFullName.toLowerCase()
      )
        return false;
      if (
        a.email &&
        creator.email &&
        a.email.toLowerCase() === creator.email.toLowerCase()
      )
        return false;
      return true;
    });

    const start = new Date(dto.startTime);
    const end = new Date(dto.endTime);

    // Recurrence validation: only allow if start and end are same day
    if (dto.isRecurring) {
      const startDay = start.toISOString().split('T')[0];
      const endDay = end.toISOString().split('T')[0];
      if (startDay !== endDay) {
        throw new BadRequestException(
          'Recurrence is only allowed for same-day events',
        );
      }
    }

    // Validate start/end times: disallow past starts (allow now and future)
    const now = new Date();
    if (start.getTime() < now.getTime()) {
      throw new BadRequestException('Start time cannot be in the past');
    }
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('End time must be after start time');
    }

    // Check if creator already has an event at the same time
    // const overlappingEvent = await this.eventRepo
    //   .createQueryBuilder('event')
    //   .leftJoin('event.createdBy', 'creator')
    //   .where('creator.id = :creatorId', { creatorId: creator.id })
    //   .andWhere('event.startTime < :end', { end: end.toISOString() })
    //   .andWhere('event.endTime > :start', { start: start.toISOString() })
    //   .getOne();

    // if (overlappingEvent) {
    //   throw new BadRequestException(
    //     'You already have another meeting overlapping this time',
    //   );
    // }
    // Check for conflicts (only check attendees)
    const attendeeIds = dto.attendees || [];
    const checkIds = [...new Set([...attendeeIds])];

    if (checkIds.length > 0) {
      await this.availabilityService.checkConflict(start, end, checkIds);
    }

    // Handle recurrence: generate RRULE if recurrence is enabled
    let recurrenceRule = dto.recurrenceRule;
    let recurrenceEndDate = dto.recurrenceEndDate
      ? new Date(dto.recurrenceEndDate)
      : undefined;
    if (dto.isRecurring && dto.recurrenceFrequency && !recurrenceRule) {
      recurrenceRule = this.recurrenceService.generateRuleFromFrequency(
        dto.recurrenceFrequency,
        start,
      );
      if (recurrenceEndDate) {
        recurrenceRule += `;UNTIL=${recurrenceEndDate.toISOString().split('T')[0].replace(/-/g, '')}`;
      }
    }

    const event = this.eventRepo.create({
      ...dto,
      startTime: start,
      endTime: end,
      attendees,
      createdBy: creator,
      isRecurring: dto.isRecurring || false,
      recurrenceRule,
      recurrenceFrequency: dto.recurrenceFrequency,
      recurrenceEndDate,
    });

    const savedEvent = await this.eventRepo.save(event);

    // Send email to attendees about event creation
    try {
      await this.mailService.sendEventCreatedMail(
        attendees,
        savedEvent,
        creator,
      );
    } catch (error) {
      console.error('Failed to send event created email:', error);
      // Don't throw - event should still be created even if email fails
    }

    // Schedule 30-minute reminder email for the first occurrence
    this.scheduleReminderEmail(savedEvent, attendees, creator);

    // If recurring, schedule notifications for next occurrences
    if (savedEvent.isRecurring && savedEvent.recurrenceRule) {
      this.scheduleRecurrenceNotifications(savedEvent, attendees, creator);
    }

    return savedEvent;
  }

  findAll() {
    return this.eventRepo.find({
      relations: ['attendees', 'createdBy'],
    });
  }

  async findByStaffIds(start: Date, end: Date, staffIds?: number[]) {
    const query = this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.attendees', 'attendees')
      .leftJoinAndSelect('event.createdBy', 'createdBy')
      .where('event.startTime <= :end AND event.endTime >= :start', { start, end });

    if (staffIds && staffIds.length > 0) {
      query.andWhere(
        '(createdBy.id IN (:...staffIds) OR attendees.id IN (:...staffIds))',
        { staffIds },
      );
    }

    return query.getMany();
  }

  findOne(id: string) {
    return this.eventRepo.findOne({
      where: { id },
      relations: ['attendees', 'createdBy'],
    });
  }

  async findMonth(year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    return this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.attendees', 'attendees')
      .leftJoinAndSelect('event.createdBy', 'createdBy')
      .where('event.startTime <= :end AND event.endTime >= :start', { start, end })
      .getMany();
  }

  async findDay(date: string) {
    const start = new Date(date + 'T00:00:00');
    const end = new Date(date + 'T23:59:59');

    return this.eventRepo
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.attendees', 'attendees')
      .leftJoinAndSelect('event.createdBy', 'createdBy')
      .where('event.startTime <= :end AND event.endTime >= :start', { start, end })
      .getMany();
  }

  async update(id: string, dto: UpdateCalenderDto, userId: number) {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['attendees', 'createdBy'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check if user is the creator or has permission to update
    if (event.createdBy.id !== userId) {
      throw new ForbiddenException('You can only update events you created');
    }

    const start = dto.startTime ? new Date(dto.startTime) : event.startTime;
    const end = dto.endTime ? new Date(dto.endTime) : event.endTime;

    // Validate times if start/end provided or changed
    const now = new Date();
    if (dto.startTime && start.getTime() < now.getTime()) {
      throw new BadRequestException('Start time cannot be in the past');
    }
    if (dto.startTime || dto.endTime) {
      if (end.getTime() <= start.getTime()) {
        throw new BadRequestException('End time must be after start time');
      }
    }

    // By default keep existing attendees
    let attendees = event.attendees;

    // If dto.attendees is provided (even empty array) treat it as replacement
    if (dto.attendees !== undefined) {
      // Find by ids (will return [] if empty array)
      const newAttendees =
        dto.attendees.length > 0
          ? await this.staffRepo.find({
            where: { id: In(dto.attendees) },
          })
          : [];

      // Remove creator from the provided attendees list
      attendees = newAttendees.filter((a) => {
        if (!a) return false;
        if (a.id === event.createdBy.id) return false;
        const creatorFullName =
          `${event.createdBy.firstName} ${event.createdBy.lastName}`.trim();
        const attendeeFullName = `${a.firstName} ${a.lastName}`.trim();
        if (
          attendeeFullName &&
          creatorFullName &&
          attendeeFullName.toLowerCase() === creatorFullName.toLowerCase()
        )
          return false;
        if (
          a.email &&
          event.createdBy.email &&
          a.email.toLowerCase() === event.createdBy.email.toLowerCase()
        )
          return false;
        return true;
      });
    }

    // Check for conflicts with new attendee list (only check attendees)
    const attendeeIds = attendees.map((a) => a.id);
    const checkIds = [...new Set([...attendeeIds])];
    if (checkIds.length > 0) {
      await this.availabilityService.checkConflict(start, end, checkIds, id);
    }

    // Handle recurrence: generate RRULE if recurrence is enabled
    let recurrenceRule = event.recurrenceRule;
    const isRecurringUpdated =
      dto.isRecurring !== undefined ? dto.isRecurring : event.isRecurring;
    const recurrencyFrequencyUpdated =
      dto.recurrenceFrequency || event.recurrenceFrequency;

    if (
      isRecurringUpdated &&
      recurrencyFrequencyUpdated &&
      !dto.recurrenceRule
    ) {
      recurrenceRule = this.recurrenceService.generateRuleFromFrequency(
        recurrencyFrequencyUpdated,
        start,
      );
    } else if (dto.recurrenceRule) {
      recurrenceRule = dto.recurrenceRule;
    }

    // Handle recurrence end date conversion if provided
    let recurrenceEndDate = event.recurrenceEndDate;
    if (dto.recurrenceEndDate) {
      recurrenceEndDate = new Date(dto.recurrenceEndDate);
    }

    // Exclude special fields from dto to handle them explicitly via merge
    const {
      attendees: _,
      startTime: __,
      endTime: ___,
      isRecurring: ____,
      recurrenceFrequency: _____,
      recurrenceRule: ______,
      recurrenceEndDate: _______,
      ...otherData
    } = dto;

    // Explicitly update properties
    event.title = dto.title ?? event.title;
    event.description = dto.description ?? event.description;
    event.startTime = start;
    event.endTime = end;
    event.location = dto.location ?? event.location;
    event.meetingLink = dto.meetingLink ?? event.meetingLink;
    event.color = dto.color ?? event.color;
    event.type = dto.type ?? event.type;
    event.isRecurring = isRecurringUpdated;
    event.recurrenceRule = recurrenceRule;
    event.recurrenceFrequency = recurrencyFrequencyUpdated;
    event.recurrenceEndDate = recurrenceEndDate;
    event.attendees = attendees;

    const savedEvent = await this.eventRepo.save(event);

    // Send update email to all attendees
    try {
      const creator = await this.staffRepo.findOneBy({ id: userId });
      if (creator) {
        await this.mailService.sendEventUpdatedMail(
          attendees,
          savedEvent,
          creator,
        );
      }
    } catch (error) {
      console.error('Failed to send update email:', error);
    }

    // If recurence was updated, reschedule notifications
    if (savedEvent.isRecurring && savedEvent.recurrenceRule) {
      this.scheduleRecurrenceNotifications(
        savedEvent,
        attendees,
        event.createdBy,
      );
    }

    return savedEvent;
  }

  async remove(id: string, userId: number) {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['createdBy'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    // Check if user is the creator
    if (event.createdBy.id !== userId) {
      throw new ForbiddenException('You can only delete events you created');
    }

    await this.eventRepo.delete(id);

    return {
      message: 'Delete successful',
    };
  }

  /**
   * Schedule reminder emails to be sent 30, 15, and 5 minutes before the event
   * In production, this should use a proper job queue like Bull or RabbitMQ
   */
  private scheduleReminderEmail(
    event: CalendarEvent,
    attendees: Staff[],
    creator: Staff,
  ) {
    const eventStartTime = new Date(event.startTime).getTime();
    const intervals = [30, 15, 5];

    intervals.forEach((minutesBefore) => {
      const now = new Date().getTime();
      const reminderTime = eventStartTime - minutesBefore * 60 * 1000;
      const delayMs = reminderTime - now;

      // Only schedule if reminder time is in the future
      if (delayMs > 0) {
        setTimeout(() => {
          this.mailService
            .sendEventReminderMail(attendees, event, creator, minutesBefore)
            .catch((error) =>
              console.error(
                `Failed to send ${minutesBefore}-minute reminder:`,
                error,
              ),
            );
        }, delayMs);
      }
    });
  }

  /**
   * Schedule notification emails for recurring event occurrences
   * Sends email at the start of each occurrence
   * In production, use a job queue like Bull or RabbitMQ for better handling
   */
  private scheduleRecurrenceNotifications(
    event: CalendarEvent,
    attendees: Staff[],
    creator: Staff,
  ) {
    if (!event.recurrenceRule) {
      return;
    }

    try {
      const now = new Date();
      const sixMonthsLater = new Date(
        now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000,
      );

      // Get next 12 occurrences within 6 months
      const occurrences = this.recurrenceService.getOccurrencesInRange(
        event.recurrenceRule,
        event.startTime,
        event.endTime,
        now,
        sixMonthsLater,
      );

      // Schedule notifications for each occurrence (skip the first one as it's already handled)
      occurrences.slice(1).forEach((occurrence) => {
        const occurrenceStart = occurrence.startTime.getTime();
        const currentTime = new Date().getTime();
        const delayMs = occurrenceStart - currentTime;

        // Only schedule if occurrence is in the future
        if (delayMs > 0) {
          setTimeout(() => {
            this.mailService
              .sendRecurrenceNotificationMail(
                attendees,
                event,
                creator,
                occurrence.startTime,
              )
              .catch((error) =>
                console.error('Failed to send recurrence notification:', error),
              );
          }, delayMs);
        }
      });
    } catch (error) {
      console.error('Error scheduling recurrence notifications:', error);
    }
  }

  /**
   * Get all instances of a recurring event within a date range
   * Useful for displaying all occurrences in the UI
   */
  async getRecurrenceInstances(
    eventId: string,
    rangeStart: Date,
    rangeEnd: Date,
  ) {
    const event = await this.eventRepo.findOne({
      where: { id: eventId },
      relations: ['attendees', 'createdBy'],
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    if (!event.isRecurring || !event.recurrenceRule) {
      // Return single event if not recurring
      return [event];
    }

    // Get all occurrences within range
    const occurrences = this.recurrenceService.getOccurrencesInRange(
      event.recurrenceRule,
      event.startTime,
      event.endTime,
      rangeStart,
      rangeEnd,
    );

    // Return event data for each occurrence
    return occurrences.map((occurrence) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      startTime: occurrence.startTime,
      endTime: occurrence.endTime,
      location: event.location,
      meetingLink: event.meetingLink,
      color: event.color,
      type: event.type,
      attendees: event.attendees,
      createdBy: event.createdBy,
      isRecurring: true,
      recurrenceRule: event.recurrenceRule,
      recurrenceFrequency: event.recurrenceFrequency,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      isInstance: true, // Flag to indicate this is an instance of a recurring event
    }));
  }

  /**
   * Get all staff available as attendees (excluding the current user/creator)
   * Used to populate the attendee dropdown when creating/updating events
   */
  async getAvailableAttendees(userId: number): Promise<Staff[]> {
    // Get all staff
    const allStaff = await this.staffRepo.find({
      select: ['id', 'firstName', 'lastName', 'email'],
    });

    // Filter out the current user (creator)
    return allStaff.filter((staff) => staff.id !== userId);
  }
}
