import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

dotenv.config();

@Injectable()
export class CeoMessagingCenterMailService {
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

  /**
   * Sends a broadcast email from the CEO to multiple staff members.
   */
  async sendBroadcastEmail(
    sender: Staff,
    recipients: Staff[],
    message: { title: string; description: string; attachments?: string[] },
  ) {
    for (const recipient of recipients) {
      try {
        await this.sendEmailToStaff(sender, recipient, message);
      } catch (error) {
        console.error(`Failed to execute broadcast send for recipient ${recipient.email}:`, error);
      }
    }
  }

  /**
   * Sends a single email from the CEO to a specific staff member.
   */
  async sendEmailToStaff(
    sender: Staff,
    recipient: Staff,
    message: { title: string; description: string; attachments?: string[] },
  ) {
    try {
      const mailOptions = {
        from: `"CEO's Office - ${sender.firstName} ${sender.lastName}" <${process.env.MAIL_USER}>`,
        to: recipient.email,
        subject: `Important Message from the CEO: ${message.title}`,
        html: this.buildBroadcastTemplate(sender, recipient, message),
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error(`❌ Failed to send email to ${recipient.email}:`, error);
    }
  }

  private buildBroadcastTemplate(
    sender: Staff,
    recipient: Staff,
    message: { title: string; description: string; attachments?: string[] },
  ) {
    const frontendUrl =
      process.env.Frontend_Domain_Url ||
      process.env.FRONTEND_URL ||
      'https://cnsquad.connectnigeria.com';
    const notificationsLink = `${frontendUrl.replace(/\/$/, '')}/notifications`;

    const attachmentSection = message.attachments?.length
      ? `
      <div style="margin-top: 15px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
        <p style="color: #374151; font-weight: bold; margin: 0 0 10px 0; font-size: 14px;">Attachments:</p>
        <ul style="padding-left: 20px; margin: 0; font-size: 14px;">
          ${message.attachments
            .map(
              (url, i) =>
                `<li style="margin-bottom: 6px;"><a href="${url}" target="_blank" style="color: #95D700; font-weight: bold; text-decoration: underline;">Attachment ${i + 1}</a></li>`,
            )
            .join('')}
        </ul>
      </div>`
      : '';

    return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 25px; background-color: #f9fafb; border-radius: 12px;">

      <!-- Header -->
      <div style="text-align: center; margin-bottom: 25px;">
        <img src="https://res.cloudinary.com/dk1hvevsa/image/upload/v1760314237/CNSQ.c73cbe03_vnsyiv.png" 
             alt="Company Logo" style="max-width: 120px; margin-bottom: 15px;" />
        <h1 style="color: #111827; font-size: 22px; margin: 0;">📢 CNSQ PORTAL — ANNOUNCEMENT</h1>
        <p style="color: #6b7280; font-size: 15px;">Important Message from the CEO</p>
      </div>

      <!-- Content -->
      <div style="background: #ffffff; padding: 25px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.05); border-left: 5px solid #95D700;">
        <p style="font-size: 16px; color: #111827; margin-top: 0;">Dear <strong>${recipient.firstName} ${recipient.lastName}</strong>,</p>
        <p style="font-size: 15px; color: #374151; line-height: 1.5; margin-bottom: 10px;">
          You have received an important announcement from the CEO, <b>${sender.firstName} ${sender.lastName}</b>:
        </p>
        <h3 style="margin: 15px 0 10px 0; color: #111827; font-size: 18px; font-weight: bold;">
          Title: ${message.title}
        </h3>
        
        <p style="font-size: 14px; color: #4b5563; line-height: 1.5; background-color: #f3f4f6; padding: 12px; border-radius: 8px; font-style: italic;">
          Note: To read the full contents of this CEO broadcast, please log in to the CNSQ Notification page.
        </p>

        ${attachmentSection}
      </div>

      <!-- Action Button -->
      <div style="margin: 30px 0; text-align: center;">
        <a href="${notificationsLink}" target="_blank" 
           style="display: inline-block; background-color: #95D700; color: #ffffff; font-weight: bold; font-size: 15px; padding: 14px 32px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 12px rgba(149, 215, 0, 0.25);">
          Login to CNSQ Portal
        </a>
        <p style="margin-top: 12px; font-size: 11px; color: #6b7280;">
          Direct Link: <a href="${notificationsLink}" target="_blank" style="color: #95D700; text-decoration: underline;">${notificationsLink}</a>
        </p>
      </div>

      <!-- Footer -->
      <div style="text-align: center; margin-top: 25px; color: #6b7280; font-size: 14px;">
        <p style="margin: 0; color: #374151; font-weight: bold;">Office of the CEO — Chief Executive Officer (CEO)</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p>&copy; ${new Date().getFullYear()} CNSQ Portal. Official internal broadcast communication.</p>
      </div>
    </div>
    `;
  }
}
