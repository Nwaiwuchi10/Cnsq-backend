// src/tasks/mail/task-mail.service.ts
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Task } from '../entities/task.entity';
import { TaskComment } from '../entities/task-comments.entity';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class TaskMailService {
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

  /** Task Created */
  async sendTaskCreatedMail(staff: Staff, task: Task, role: string) {
    const dueDateStr = task.dueDate ? new Date(task.dueDate).toDateString() : 'Not set';

    const mailOptions = {
      from: `"Task Manager" <${process.env.MAIL_USER}>`,
      to: staff.email,
      subject: `🆕 New Task Assigned: ${task.title}`,
      html: this.buildTemplate({
        title: `New Task Created 🚀`,
        subtitle: `${staff.firstName}, you’ve been assigned to <b>${task.title}</b> as <b>${role}</b>.`,
        details: `
          <p><b>Description:</b> ${task.description ?? 'No description provided'}</p>
          <p><b>Priority:</b> ${task.priority}</p>
          <p><b>Urgency:</b> ${task.urgency}</p>
          <p><b>Due Date:</b> ${dueDateStr}</p>
        `,
        footerNote:
          'Please log in to your dashboard to start working on this task.',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send task creation email:', error);
    }
  }

  /** Task Updated */
  async sendTaskUpdatedMail(staff: Staff, task: Task) {
    const dueDateStr = task.dueDate ? new Date(task.dueDate).toDateString() : 'Not set';

    const mailOptions = {
      from: `"Task Manager" <${process.env.MAIL_USER}>`,
      to: staff.email,
      subject: `✏️ Task Updated: ${task.title}`,
      html: this.buildTemplate({
        title: `Task Updated ✨`,
        subtitle: `${task.title} has been updated.`,
        details: `
          <p><b>Status:</b> ${task.status}</p>
          <p><b>Priority:</b> ${task.priority}</p>
          <p><b>Urgency:</b> ${task.urgency}</p>
          <p><b>Due Date:</b> ${dueDateStr}</p>
        
        `,
        footerNote: 'Stay aligned with the changes 🚀',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send task updated email:', error);
    }
  }

  /** Task Comment Mention */
  async sendMentionMail(mentioned: Staff, comment: TaskComment, task: Task) {
    const mailOptions = {
      from: `"Task Manager" <${process.env.MAIL_USER}>`,
      to: mentioned.email,
      subject: `💬 You were mentioned in a task comment: ${task.title}`,
      html: this.buildTemplate({
        title: `You were mentioned 👀`,
        subtitle: `${comment.staff.firstName} mentioned you in a comment on <b>${task.title}</b>.`,
        details: `
          <blockquote style="border-left: 4px solid #4CAF50; margin: 10px 0; padding-left: 10px; color: #374151;">
            ${comment.text}
          </blockquote>
        `,
        footerNote: 'Please reply or take action in your dashboard.',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send mention alert email:', error);
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
        <p>Best regards,<br><b>Task Management Team</b></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p>&copy; ${new Date().getFullYear()} Our Company. All rights reserved.</p>
      </div>
    </div>
    `;
  }
}
