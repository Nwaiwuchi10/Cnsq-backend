import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { CalendarEvent } from '../entities/calender.entity';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class CalendarMailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: process.env.MAIL_SERVICE,
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  /** Event Created - Send to all attendees */
  async sendEventCreatedMail(
    attendees: Staff[],
    event: CalendarEvent,
    creator: Staff,
  ) {
    const attendeeEmails = attendees.map((a) => a.email).join(', ');

    const mailOptions = {
      from: `"Calendar Manager" <${process.env.MAIL_USER}>`,
      to: attendeeEmails,
      subject: `📅 New Calendar Event: ${event.title}`,
      html: this.buildTemplate({
        title: `New Meeting Scheduled 🚀`,
        subtitle: `${creator.firstName} ${creator.lastName} has created a new calendar event.`,
        details: `
          <p><b>Event Title:</b> ${event.title}</p>
          <p><b>Type:</b> ${event.type}</p>
          <p><b>Description:</b> ${event.description ?? 'No description provided'}</p>
          <p><b>Date & Time:</b> ${new Date(event.startTime).toLocaleString()} - ${new Date(event.endTime).toLocaleString()}</p>
          ${event.location ? `<p><b>Location:</b> ${event.location}</p>` : ''}
          ${event.meetingLink ? `<p><b>Meeting Link:</b> <a href="${event.meetingLink}">${event.meetingLink}</a></p>` : ''}
          ${event.isRecurring ? `<p><b>Recurrence:</b> Yes (${event.recurrenceRule})</p>` : ''}
        `,
        footerNote:
          'Please check your calendar and confirm your attendance if needed.',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send calendar event creation email:', error);
    }
  }

  /** Event Reminder - Sent at specific intervals before the event */
  async sendEventReminderMail(
    attendees: Staff[],
    event: CalendarEvent,
    creator: Staff,
    minutesBefore: number,
  ) {
    const attendeeEmails = attendees.map((a) => a.email).join(', ');

    const mailOptions = {
      from: `"Calendar Manager" <${process.env.MAIL_USER}>`,
      to: attendeeEmails,
      subject: `⏰ Reminder: ${event.title} starts in ${minutesBefore} minutes`,
      html: this.buildTemplate({
        title: `Meeting Reminder ⏰`,
        subtitle: `Your meeting <b>${event.title}</b> starts in ${minutesBefore} minutes!`,
        details: `
          <p><b>Event Title:</b> ${event.title}</p>
          <p><b>Start Time:</b> ${new Date(event.startTime).toLocaleString()}</p>
          <p><b>Duration:</b> ${Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000)} minutes</p>
          ${event.location ? `<p><b>Location:</b> ${event.location}</p>` : ''}
          ${event.meetingLink ? `<p><b>Meeting Link:</b> <a href="${event.meetingLink}">${event.meetingLink}</a></p>` : ''}
        `,
        footerNote: 'Get ready for your upcoming meeting!',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send calendar event reminder email:', error);
    }
  }

  /** Event Updated */
  async sendEventUpdatedMail(
    attendees: Staff[],
    event: CalendarEvent,
    creator: Staff,
  ) {
    const attendeeEmails = attendees.map((a) => a.email).join(', ');

    const mailOptions = {
      from: `"Calendar Manager" <${process.env.MAIL_USER}>`,
      to: attendeeEmails,
      subject: `✏️ Calendar Event Updated: ${event.title}`,
      html: this.buildTemplate({
        title: `Event Updated ✨`,
        subtitle: `${creator.firstName} ${creator.lastName} has updated the calendar event.`,
        details: `
          <p><b>Event Title:</b> ${event.title}</p>
          <p><b>New Date & Time:</b> ${new Date(event.startTime).toLocaleString()} - ${new Date(event.endTime).toLocaleString()}</p>
          ${event.location ? `<p><b>Location:</b> ${event.location}</p>` : ''}
          ${event.meetingLink ? `<p><b>Meeting Link:</b> <a href="${event.meetingLink}">${event.meetingLink}</a></p>` : ''}
        `,
        footerNote: 'Please update your calendar accordingly.',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send calendar event update email:', error);
    }
  }

  /** Recurring Event Notification - Send on each recurrence date */
  async sendRecurrenceNotificationMail(
    attendees: Staff[],
    event: CalendarEvent,
    creator: Staff,
    occurrenceDate: Date,
  ) {
    const attendeeEmails = attendees.map((a) => a.email).join(', ');
    const occurrenceEnd = new Date(
      occurrenceDate.getTime() +
      (new Date(event.endTime).getTime() -
        new Date(event.startTime).getTime()),
    );

    const mailOptions = {
      from: `"Calendar Manager" <${process.env.MAIL_USER}>`,
      to: attendeeEmails,
      subject: `📅 Recurring Event Notice: ${event.title}`,
      html: this.buildTemplate({
        title: `Recurring Event Notification 🔄`,
        subtitle: `This is a recurring meeting created by ${creator.firstName} ${creator.lastName}.`,
        details: `
          <p><b>Event Title:</b> ${event.title}</p>
          <p><b>Type:</b> ${event.type}</p>
          <p><b>Description:</b> ${event.description ?? 'No description provided'}</p>
          <p><b>Occurrence Date & Time:</b> ${occurrenceDate.toLocaleString()} - ${occurrenceEnd.toLocaleString()}</p>
          ${event.location ? `<p><b>Location:</b> ${event.location}</p>` : ''}
          ${event.meetingLink ? `<p><b>Meeting Link:</b> <a href="${event.meetingLink}">${event.meetingLink}</a></p>` : ''}
          <p><b>Recurrence:</b> This is part of a recurring series</p>
        `,
        footerNote:
          'Mark your calendar for this recurring event. You will receive updates for each occurrence.',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send calendar event recurrence email:', error);
    }
  }

  /** === Shared Email Template === */
  private buildTemplate({
    title,
    subtitle,
    details,
    footerNote,
  }: {
    title: string;
    subtitle: string;
    details: string;
    footerNote: string;
  }) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 25px; background-color: #f9fafb; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 25px;">
        <img src="https://res.cloudinary.com/dk1hvevsa/image/upload/v1760314237/CNSQ.c73cbe03_vnsyiv.png" 
             alt="Company Logo" style="max-width: 120px; margin-bottom: 15px;" />
        <h1 style="color: #111827; font-size: 22px; margin: 0;">${title}</h1>
        <p style="color: #6b7280; font-size: 15px;">${subtitle}</p>
      </div>

      <div style="background: #ffffff; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
        ${details}
      </div>

      <div style="text-align: center; margin-top: 25px; color: #6b7280; font-size: 14px;">
        <p>${footerNote}</p>
        <p>Best regards,<br><b>Calendar Management Team</b></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p>&copy; ${new Date().getFullYear()} Our Company. All rights reserved.</p>
      </div>
    </div>
    `;
  }
}
