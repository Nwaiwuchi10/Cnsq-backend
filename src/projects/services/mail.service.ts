// src/projects/mail/project-mail.service.ts
import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Project } from '../entities/project.entity';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class ProjectMailService {
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

  // === Assignment Mail ===
  async sendAssignmentMail(staff: Staff, project: Project, role: string) {
    const startDateStr = project.startDate ? new Date(project.startDate).toDateString() : 'N/A';
    const endDateStr = project.endDate ? new Date(project.endDate).toDateString() : 'N/A';

    const mailOptions = {
      from: `"Project Management" <${process.env.MAIL_USER}>`,
      to: staff.email,
      subject: `📌 You have been assigned to project: ${project.projectName}`,
      html: this.buildTemplate({
        title: `New Project Assignment 🚀`,
        subtitle: `${staff.firstName}, you’ve been assigned to <b>${project.projectName}</b> as <b>${role}</b>.`,
        details: `
          <p><b>Project Timeline:</b> ${startDateStr} – ${endDateStr}</p>
          <p><b>Status:</b> ${project.status}</p>
          <p><b>Priority:</b> ${project.priority}</p>
        `,
        footerNote: 'Please check your dashboard for more details.',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send project assignment email:', error);
    }
  }

  // === Project Update Mail ===
  async sendUpdateMail(staff: Staff, project: Project) {
    const startDateStr = project.startDate ? new Date(project.startDate).toDateString() : 'N/A';
    const endDateStr = project.endDate ? new Date(project.endDate).toDateString() : 'N/A';

    const mailOptions = {
      from: `"Project Management" <${process.env.MAIL_USER}>`,
      to: staff.email,
      subject: `🔄 Project update: ${project.projectName}`,
      html: this.buildTemplate({
        title: `Project Updated ✨`,
        subtitle: `${project.projectName} has been updated.`,
        details: `
          <p><b>Status:</b> ${project.status}</p>
          <p><b>Priority:</b> ${project.priority}</p>
          <p><b>Timeline:</b> ${startDateStr} – ${endDateStr}</p>
        `,
        footerNote:
          'Stay aligned with the updates, You got this message because you are assigned to this project 🚀',
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Failed to send project update email:', error);
    }
  }

  // === Template Builder (Generic UI) ===
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
        <p>Best regards,<br><b>Project Management Team</b></p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p>&copy; ${new Date().getFullYear()} Our Company. All rights reserved.</p>
      </div>
    </div>
    `;
  }
}
