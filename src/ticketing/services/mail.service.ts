import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Ticket } from '../entities/ticket.entity';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class TicketingMailService {
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

  async sendTicketStatusChangedMail(staff: Staff, ticket: Ticket) {
    const mailOptions = {
      from: `"Ticketing System" <${process.env.MAIL_USER}>`,
      to: staff.email,
      subject: `🔄 Ticket Status Updated: ${ticket.subject}`,
      html: this.buildTemplate({
        title: `Ticket Status Updated 🔄`,
        subtitle: `${staff.firstName}, your ticket <b>${ticket.ticketRef}</b> is now marked as <b>${ticket.status}</b>.`,
        details: `
          <p><b>Subject:</b> ${ticket.subject}</p>
          <p><b>New Status:</b> ${ticket.status}</p>
          <p><b>Priority:</b> ${ticket.priority}</p>
        `,
        footerNote: 'Log in to your dashboard to view more details.',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send ticket status email:', error);
    }
  }

  async sendTicketCreatedMail(staff: Staff, ticket: Ticket, creatorName: string) {
    const mailOptions = {
      from: `"Ticketing System" <${process.env.MAIL_USER}>`,
      to: staff.email,
      subject: `🎫 New Ticket Assigned to Your Department: ${ticket.ticketRef}`,
      html: this.buildTemplate({
        title: `New Ticket Submitted 🎫`,
        subtitle: `Hello ${staff.firstName}, a new ticket has been submitted to your department by ${creatorName}.`,
        details: `
          <p><b>Ticket Ref:</b> ${ticket.ticketRef}</p>
          <p><b>Subject:</b> ${ticket.subject}</p>
          <p><b>Priority:</b> ${ticket.priority}</p>
        `,
        footerNote: 'Log in to your dashboard to review this ticket.',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send ticket creation email:', error);
    }
  }

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
        <p>Best regards,<br><b>Ticketing Team</b></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p>&copy; ${new Date().getFullYear()} Our Company. All rights reserved.</p>
      </div>
    </div>
    `;
  }
}
