// src/staff/mail/mail.service.ts
import * as nodemailer from 'nodemailer';
import { Injectable } from '@nestjs/common';

import * as dotenv from 'dotenv';
import { Staff } from '../entities/staff-register.entity';
import { NotificationSettingsService } from 'src/notification-settings/notification-settings.service';

dotenv.config();

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly notificationSettingsService: NotificationSettingsService,
  ) {
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

  // === ONBOARDING MAIL — always sent, not gated by preferences ===
  async staffOnboardingMail(staff: Staff) {
    const mailOptions = {
      from: `"HR Department" <${process.env.MAIL_USER}>`,
      to: staff.email,
      subject: `🎉 Welcome to Our Company, ${staff.firstName}!`,
      html: this.buildTemplate({
        title: `Welcome to the Team, ${staff.firstName} ${staff.lastName} 🎉`,
        subtitle: `We're thrilled to have you onboard!`,
        staff,
        footerNote: 'We look forward to your impact and growth 🚀',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send staff onboarding email:', error);
    }
  }

  // === LOGIN MAIL — gated by emailNotifications preference ===
  async staffLoginMail(staff: Staff) {
    // Check if this staff has email notifications enabled
    const emailsAllowed = await this.notificationSettingsService.isAllowed(
      staff.id,
      'emailNotifications',
    );
    if (!emailsAllowed) return; // staff opted out of email notifications

    const mailOptions = {
      from: `"Security Team" <${process.env.MAIL_USER}>`,
      to: staff.email,
      subject: `🔑 Login Alert for ${staff.firstName}`,
      html: this.buildTemplate({
        title: `Login Successful ✅`,
        subtitle: `Hello ${staff.firstName}, you logged into your account just now.`,
        staff,
        footerNote:
          'If this wasn\'t you, please reset your password immediately.',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send login alert email:', error);
    }
  }

  // === PASSWORD RESET MAIL — system-critical, not gated by preferences ===
  async sendPasswordResetEmail(email: string, token: string) {
    const resetLink = `${process.env.Frontend_Domain_Url}/reset-password?token=${token}`;

    const mailOptions = {
      from: `"Support Team" <${process.env.MAIL_USER}>`,
      to: email,
      subject: '🔐 Password Reset Request',
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 25px; background-color: #f9fafb; border-radius: 12px;">
        
        <div style="text-align: center; margin-bottom: 25px;">
          <img src="https://res.cloudinary.com/dk1hvevsa/image/upload/v1760314237/CNSQ.c73cbe03_vnsyiv.png" 
              alt="Company Logo" style="max-width: 120px; margin-bottom: 15px;" />
          <h1 style="color: #111827; font-size: 22px; margin: 0;">Password Reset Request</h1>
          <p style="color: #6b7280; font-size: 15px;">
            You requested a password reset. Click the button below to continue.
          </p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${resetLink}"
            style="background-color: #95D700; padding: 12px 25px; 
              color:white; text-decoration:none; border-radius:8px; 
              font-size:16px; font-weight:bold;">
            Reset Password
          </a>
        </div>

        <p style="color: #374151; font-size: 14px; text-align: center;">
          Or copy and paste the link below into your browser:
        </p>

        <p style="text-align:center; word-break:break-all; font-size:14px; color:#1d4ed8;">
          ${resetLink}
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;" />

        <p style="color: #6b7280; font-size: 14px; text-align:center;">
          This link will expire in <b>10 minutes</b>.  
          If you did not request this, you can safely ignore this email.
        </p>

        <p style="text-align:center; margin-top:20px; color:#6b7280;">
          &copy; ${new Date().getFullYear()} Our Company. All rights reserved.
        </p>
      </div>
    `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
    }
  }

  // === LEAVE REQUEST MAIL — sent to supervisor ===
  async sendLeaveRequestToSupervisor(staff: Staff, supervisor: Staff, leaveType: string, startDate: string, endDate: string) {
    const emailsAllowed = await this.notificationSettingsService.isAllowed(
      supervisor.id,
      'emailNotifications',
    );
    if (!emailsAllowed) return;

    const mailOptions = {
      from: `"HR System" <${process.env.MAIL_USER}>`,
      to: supervisor.email,
      subject: `📅 New Leave Request: ${staff.firstName} ${staff.lastName}`,
      html: this.buildTemplate({
        title: `New Leave Request 📝`,
        subtitle: `${staff.firstName} has submitted a request for ${leaveType}.`,
        staff,
        footerNote: `Please review this request at your earliest convenience. <br/> <b>Duration:</b> ${startDate} to ${endDate}`,
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send leave request email to supervisor:', error);
    }
  }

  // === LEAVE SUBMISSION CONFIRMATION — sent to staff ===
  async sendLeaveSubmissionConfirmation(staff: Staff, leaveType: string, startDate: string, endDate: string) {
    const emailsAllowed = await this.notificationSettingsService.isAllowed(
      staff.id,
      'emailNotifications',
    );
    if (!emailsAllowed) return;

    const mailOptions = {
      from: `"HR Department" <${process.env.MAIL_USER}>`,
      to: staff.email,
      subject: `Leave Request Submitted: ${leaveType}`,
      html: this.buildTemplate({
        title: `Leave Request Received ⏳`,
        subtitle: `You have successfully submitted a request for ${leaveType}.`,
        staff,
        footerNote: `Your request is currently pending supervisor approval. <br/> <b>Duration:</b> ${startDate} to ${endDate}`,
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send leave confirmation email:', error);
    }
  }

  // === LEAVE STATUS MAIL — sent to staff ===
  async sendLeaveStatusUpdate(staff: Staff, status: string, reviewNotes: string) {
    const emailsAllowed = await this.notificationSettingsService.isAllowed(
      staff.id,
      'emailNotifications',
    );
    if (!emailsAllowed) return;

    const statusIcon = status === 'Approved' ? '✅' : '❌';
    const mailOptions = {
      from: `"HR Department" <${process.env.MAIL_USER}>`,
      to: staff.email,
      subject: `Leave Request ${status}: ${staff.firstName}`,
      html: this.buildTemplate({
        title: `Leave Request ${status} ${statusIcon}`,
        subtitle: `Your leave request has been marked as <b>${status}</b>.`,
        staff,
        footerNote: reviewNotes ? `<b>Note from Reviewer:</b> ${reviewNotes}` : 'Your request has been processed.',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send leave status update email:', error);
    }
  }

  // === LEAVE HANDOVER NOTIFICATION — sent to handover staff when a leave is created ===
  async sendLeaveHandoverNotification(
    handoverStaff: Staff,
    requestingStaff: Staff,
    leaveType: string,
    startDate: string,
    endDate: string,
  ) {
    const emailsAllowed = await this.notificationSettingsService.isAllowed(
      handoverStaff.id,
      'emailNotifications',
    );
    if (!emailsAllowed) return;

    const mailOptions = {
      from: `"HR System" <${process.env.MAIL_USER}>`,
      to: handoverStaff.email,
      subject: `📋 Handover Assignment: ${requestingStaff.firstName} ${requestingStaff.lastName}`,
      html: this.buildTemplate({
        title: `You Have Been Assigned as Handover Staff 📋`,
        subtitle: `${requestingStaff.firstName} ${requestingStaff.lastName} has submitted a leave request and selected you as their handover person.`,
        staff: handoverStaff,
        footerNote: `<b>Leave Type:</b> ${leaveType}<br/><b>Duration:</b> ${startDate} to ${endDate}<br/>Please coordinate with ${requestingStaff.firstName} to ensure a smooth handover before their leave begins.`,
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send leave handover email:', error);
    }
  }

  // === LEAVE EDIT NOTIFICATION — sent to supervisors when a staff edits their leave request ===
  async sendLeaveEditNotificationToSupervisor(
    staff: Staff,
    supervisor: Staff,
    leaveType: string,
    startDate: string,
    endDate: string,
  ) {
    const emailsAllowed = await this.notificationSettingsService.isAllowed(
      supervisor.id,
      'emailNotifications',
    );
    if (!emailsAllowed) return;

    const mailOptions = {
      from: `"HR System" <${process.env.MAIL_USER}>`,
      to: supervisor.email,
      subject: `✏️ Leave Request Updated: ${staff.firstName} ${staff.lastName}`,
      html: this.buildTemplate({
        title: `Leave Request Updated ✏️`,
        subtitle: `${staff.firstName} ${staff.lastName} has edited their ${leaveType} leave request.`,
        staff,
        footerNote: `<b>Updated Duration:</b> ${startDate} to ${endDate}<br/>Please review the updated request at your earliest convenience.`,
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send leave edit notification email to supervisor:', error);
    }
  }

  // === CHANNEL ADDED MAIL ===
  async sendChannelAddedEmail(staff: Staff, channelName: string) {
    const emailsAllowed = await this.notificationSettingsService.isAllowed(
      staff.id,
      'emailNotifications',
    );
    if (!emailsAllowed) return;

    const mailOptions = {
      from: `"ConnectNigeria Chat" <${process.env.MAIL_USER}>`,
      to: staff.email,
      subject: `📣 You've been added to #${channelName}`,
      html: this.buildTemplate({
        title: `Added to Channel #${channelName} 💬`,
        subtitle: `Hello ${staff.firstName}, you have been added to the channel #${channelName}.`,
        staff,
        footerNote: `Open your ConnectNigeria app to view discussions and participate in #${channelName}.`,
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send channel added email:', error);
    }
  }

  // === REGISTRATION COMPLETE MAIL ===
  async sendRegistrationEmail(staff: Staff, tempPassword: string, token: string) {
    const link = `${process.env.Frontend_Domain_Url || 'http://localhost:3000'}/complete-registration?token=${token}`;

    const mailOptions = {
      from: `"HR Onboarding" <${process.env.MAIL_USER}>`,
      to: staff.email,
      subject: `🎉 Complete Your Account Registration`,
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 25px; background-color: #f9fafb; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 25px;">
          <img src="https://res.cloudinary.com/dk1hvevsa/image/upload/v1760314237/CNSQ.c73cbe03_vnsyiv.png" 
               alt="Company Logo" style="max-width: 120px; margin-bottom: 15px;" />
          <h1 style="color: #111827; font-size: 22px; margin: 0;">Welcome to the Team, ${staff.firstName}!</h1>
          <p style="color: #6b7280; font-size: 15px;">Your account has been created. Please complete your registration.</p>
        </div>

        <div style="background: #ffffff; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
          <h2 style="color: #111827; font-size: 16px; margin-bottom: 10px;">🔑 Temporary Account Credentials</h2>
          <p style="margin: 6px 0;"><b>Email:</b> ${staff.email}</p>
          <p style="margin: 6px 0;"><b>Temporary Password:</b> <code style="background:#e5e7eb; padding:2px 6px; border-radius:4px; font-weight:bold;">${tempPassword}</code></p>
          <p style="font-size:12px; color:#ef4444; margin-top:8px;">* Please copy/note down your temporary password as you will need it to complete registration.</p>
        </div>

        <div style="text-align: center; margin: 25px 0;">
          <a href="${link}"
             style="background-color: #95D700; padding: 12px 25px; 
               color:black; text-decoration:none; border-radius:8px; 
               font-size:16px; font-weight:bold; display:inline-block;">
            Complete Registration
          </a>
        </div>

        <p style="color: #374151; font-size: 14px; text-align: center;">
          Or copy and paste this verification link into your browser:
        </p>

        <p style="text-align:center; word-break:break-all; font-size:13px; color:#1d4ed8;">
          ${link}
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 25px 0;" />

        <p style="color: #6b7280; font-size: 13px; text-align:center;">
          <b>Note:</b> This verification link will expire in <b>15 minutes</b>.
        </p>
      </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send registration email:', error);
    }
  }

  // === TEMPLATE BUILDER — Generates a consistent branded HTML email layout ===
  private buildTemplate({
    title,
    subtitle,
    staff,
    footerNote,
  }: {
    title: string;
    subtitle: string;
    staff: Staff;
    footerNote: string;
  }) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 25px; background-color: #f9fafb; border-radius: 12px;">

      <!-- Header -->
      <div style="text-align: center; margin-bottom: 25px;">
        <img src="https://res.cloudinary.com/dk1hvevsa/image/upload/v1760314237/CNSQ.c73cbe03_vnsyiv.png" 
             alt="Company Logo" style="max-width: 120px; margin-bottom: 15px;" />
        <h1 style="color: #111827; font-size: 22px; margin: 0;">${title}</h1>
        <p style="color: #6b7280; font-size: 15px;">${subtitle}</p>
      </div>

      <!-- Personal Info -->
      <div style="background: #ffffff; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
        <h2 style="color: #111827; font-size: 18px; margin-bottom: 12px;">👤 Personal Details</h2>
        <p style="margin: 6px 0;"><b>Full Name:</b> ${staff.firstName} ${staff.lastName}</p>
        <p style="margin: 6px 0;"><b>Email:</b> ${staff.email}</p>
      </div>

      <!-- Employment (if exists) -->
      ${
        staff.employment
          ? `
      <div style="background: #ffffff; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
        <h2 style="color: #111827; font-size: 18px; margin-bottom: 12px;">💼 Employment Details</h2>
        <p style="margin: 6px 0;"><b>Employee Code:</b> ${staff.employment.employeeCode}</p>
        <p style="margin: 6px 0;"><b>Job Title:</b> ${staff.employment.jobTitle?.join(', ')}</p>
      </div>
      `
          : ''
      }

      <!-- Footer -->
      <div style="text-align: center; margin-top: 25px; color: #6b7280; font-size: 14px;">
        <div style="padding: 15px; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #374151;">${footerNote}</p>
        </div>
        <p style="margin-top: 20px;">Best regards,<br><b>HR Department</b></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p>&copy; ${new Date().getFullYear()} Our Company. All rights reserved.</p>
      </div>
    </div>
    `;
  }
}
