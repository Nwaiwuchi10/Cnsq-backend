// src/message/mail/message-mail.service.ts
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { CreateMessageCeoDto } from '../dto/create-message-ceo.dto';

dotenv.config();

@Injectable()
export class MessageCeoMailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: process.env.MAIL_SERVICE,
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  async sendEmailToCEO(staff: Staff, dto: CreateMessageCeoDto) {
    const ceoMailOptions = {
      from: `"${staff.firstName} ${staff.lastName}" <${process.env.MAIL_USER}>`,
      to: process.env.CEO_EMAIL || 'emeka@connectnigeria.com',
      subject: dto.subject,
      html: this.buildTemplate({
        staff,
        body: dto.content,
        subject: dto.subject,
        attachments: dto.attachments,
      }),
    };

    // ✅ Send message to CEO
    try {
      await this.transporter.sendMail(ceoMailOptions);
    } catch (error) {
      console.error('❌ Failed to send email to CEO:', error);
    }

    // ✅ Send confirmation email to staff
    try {
      await this.sendConfirmationToStaff(staff, dto);
    } catch (error) {
      console.error('❌ Failed to send confirmation email to staff:', error);
    }
  }

  async sendCeoReplyToStaff(
    recipientStaff: Staff,
    replyContent: string,
    originalSubject: string,
    ceoStaff: Staff,
    replyAttachments?: string[],
  ) {
    try {
      const mailOptions = {
        from: `"CNSQ CEO Office - ${ceoStaff.firstName}" <${process.env.MAIL_USER}>`,
        to: recipientStaff.email,
        subject: `RE: ${originalSubject}`,
        html: this.buildReplyTemplate(
          recipientStaff,
          replyContent,
          originalSubject,
          ceoStaff,
          replyAttachments,
        ),
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('❌ Failed to send CEO reply email:', error);
    }
  }

  private async sendConfirmationToStaff(
    staff: Staff,
    dto: CreateMessageCeoDto,
  ) {
    try {
      const staffMailOptions = {
        from: `"CNSQ CEO Office" <${process.env.MAIL_USER}>`,
        to: staff.email,
        subject: `Copy of Your Message to CEO: ${dto.subject}`,
        html: this.buildConfirmationTemplate(staff, dto),
      };

      await this.transporter.sendMail(staffMailOptions);
    } catch (error) {
      console.error('❌ Failed to send confirmation email to staff:', error);
    }
  }

  private buildTemplate({
    staff,
    body,
    subject,
    attachments,
  }: {
    staff: Staff;
    body: string;
    subject: string;
    attachments?: string[];
  }) {
    const attachmentSection = attachments?.length
      ? `
      <div style="margin-top: 20px;">
        <p><strong>Attached File${attachments.length > 1 ? 's' : ''}:</strong></p>
        <ul style="list-style-type: none; padding-left: 0;">
          ${attachments
            .map(
              (url, index) =>
                `<li style="margin-bottom: 8px;">
                  <a href="${url}" target="_blank" style="color: #2563eb; text-decoration: none;">
                    View Attachment ${attachments.length > 1 ? index + 1 : ''}
                  </a>
                </li>`,
            )
            .join('')}
        </ul>
      </div>
      `
      : '';

    return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 25px; background-color: #f9fafb; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 25px;">
        <img src="https://res.cloudinary.com/dk1hvevsa/image/upload/v1760314237/CNSQ.c73cbe03_vnsyiv.png" 
             alt="Company Logo" style="max-width: 120px; margin-bottom: 15px;" />
        <h2 style="color: #111827; font-size: 20px; margin: 0;">Staff Message to CEO</h2>
        <p style="color: #6b7280; font-size: 15px;">Subject: ${subject}</p>
      </div>

      <div style="background: #ffffff; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
        <p>Greetings Sir,</p>
        <p style="white-space: pre-wrap;">${body}</p>
        ${attachmentSection}
      </div>

      <div style="text-align: center; margin-top: 25px; color: #6b7280; font-size: 14px;">
        <p><strong>From:</strong> ${staff.firstName} ${staff.lastName}</p>
        <p><strong>Email:</strong> ${staff.email}</p>
         <p><strong>PhoneNumber:</strong> ${staff.phone}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p>&copy; ${new Date().getFullYear()} CNSQ. All rights reserved.</p>
      </div>
    </div>
    `;
  }

  private buildConfirmationTemplate(staff: Staff, dto: CreateMessageCeoDto) {
    const attachmentList = dto.attachments?.length
      ? dto.attachments
          .map(
            (url, i) =>
              `<li><a href="${url}" style="color:#2563eb;" target="_blank">Attachment ${i + 1}</a></li>`,
          )
          .join('')
      : '<p>No attachments included.</p>';

    return `
    <div style="font-family: Arial, sans-serif; background:#f9fafb; padding:25px; border-radius:10px;">
      <h3 style="color:#111827;">Confirmation: Your Message Has Been Sent to the CEO</h3>
      <p>Dear ${staff.firstName},</p>
      <p>Thank you for your message. Below is a copy for your records:</p>
      
      <div style="background:#fff; padding:15px; border-radius:8px; margin-top:10px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
        <p><strong>Subject:</strong> ${dto.subject}</p>
        <p style="white-space: pre-wrap;">${dto.content}</p>
        <hr/>
        <p><strong>Attachments:</strong></p>
        <ul>${attachmentList}</ul>
      </div>
      <p><strong>Here is your contact info</strong></p>
<p>${staff.firstName} ${staff.lastName}</p>
        <p><strong>Email:</strong> ${staff.email}</p>
         <p><strong>Phone Number:</strong> ${staff.phone}</p>
      <p style="margin-top:20px;">Best regards,<br/>CNSQ CEO Office</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>
      <p style="color:#6b7280;font-size:13px;text-align:center;">© ${new Date().getFullYear()} CNSQ. All rights reserved.</p>
    </div>
    `;
  }

  private buildReplyTemplate(
    recipient: Staff,
    content: string,
    subject: string,
    ceo: Staff,
    attachments?: string[],
  ) {
    const attachmentSection = attachments?.length
      ? `
      <div style="margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
        <p><strong>Reply Attachments:</strong></p>
        <ul style="list-style-type: none; padding-left: 0;">
          ${attachments
            .map(
              (url, i) =>
                `<li style="margin-bottom: 8px;"><a href="${url}" target="_blank" style="color: #2563eb; text-decoration: none;">View File ${i + 1}</a></li>`,
            )
            .join('')}
        </ul>
      </div>`
      : '';

    return `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h2 style="color: #111827; margin: 0;">Response from CEO's Office</h2>
        <p style="color: #6b7280; margin: 5px 0;">Regarding: ${subject}</p>
      </div>
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 6px;">
        <p>Dear ${recipient.firstName},</p>
        <p style="line-height: 1.6; white-space: pre-wrap;">${content}</p>
        ${attachmentSection}
      </div>
      <div style="margin-top: 25px; text-align: center; color: #6b7280; font-size: 14px;">
        <p>Best Regards,</p>
        <p><strong>${ceo.firstName} ${ceo.lastName}</strong><br/>CEO, CNSQ</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p>&copy; ${new Date().getFullYear()} CNSQ. All rights reserved.</p>
      </div>
    </div>
    `;
  }
}
