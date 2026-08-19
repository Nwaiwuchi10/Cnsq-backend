import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { LeaveRequest, LeaveStatus } from './entities/leave-request.entity';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveStatusDto } from './dto/update-leave-status.dto';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { MailService } from '../staff-register/service/mail.service';
import { PushNotificationService } from '../push-notification/push-notification.service';
import * as dayjs from 'dayjs';

@Injectable()
export class LeaveRequestService {
  constructor(
    @InjectRepository(LeaveRequest)
    private readonly leaveRequestRepo: Repository<LeaveRequest>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    private readonly mailService: MailService,
    private readonly pushNotificationService: PushNotificationService,
  ) { }

  async create(createDto: CreateLeaveRequestDto, staffId: number, file?: Express.Multer.File) {
    const staff = await this.staffRepo.findOne({
      where: { id: staffId },
      relations: ['employment', 'employment.department'],
    });

    const handoverStaff = await this.staffRepo.findOne({
      where: { id: createDto.handoverStaffId },
    });

    if (!staff) throw new NotFoundException('Staff not found');
    if (!handoverStaff) throw new NotFoundException('Handover staff not found');

    const start = dayjs(createDto.startDate);
    const end = dayjs(createDto.endDate);
    const durationDays = end.diff(start, 'day') + 1;

    if (durationDays <= 0) {
      throw new BadRequestException('End date must be after or equal to start date');
    }

    let attachedDocument = createDto.attachedDocument;
    if (file) {
      const s3File = file as Express.Multer.File & { location: string };
      attachedDocument = s3File.location;
    }

    // Default supervisors from employment data
    const additionalSupervisorIds = [...(createDto.supervisorIds || [])];

    const findStaffByName = async (name: string) => {
      if (!name) return null;
      const parts = name.trim().split(/\s+/);
      if (parts.length < 1) return null;

      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');

      const qb = this.staffRepo.createQueryBuilder('staff')
        .where('LOWER(staff.firstName) = LOWER(:firstName)', { firstName });

      if (lastName) {
        qb.andWhere('LOWER(staff.lastName) = LOWER(:lastName)', { lastName });
      }

      return qb.getOne();
    };

    if (staff.employment?.reportingManager) {
      const manager = await findStaffByName(staff.employment.reportingManager);
      if (manager && !additionalSupervisorIds.includes(manager.id)) {
        additionalSupervisorIds.push(manager.id);
      }
    }

    if (staff.employment?.directReport) {
      const report = await findStaffByName(staff.employment.directReport);
      if (report && !additionalSupervisorIds.includes(report.id)) {
        additionalSupervisorIds.push(report.id);
      }
    }

    const supervisors = await this.staffRepo.find({
      where: { id: In(additionalSupervisorIds) },
    });

    if (!supervisors || supervisors.length === 0) {
      throw new BadRequestException('At least one supervisor is required (none found in defaults or selection)');
    }

    const leaveRequest = this.leaveRequestRepo.create({
      ...createDto,
      staffId,
      durationDays,
      attachedDocument,
      supervisors,
    });

    const savedRequest = await this.leaveRequestRepo.save(leaveRequest);

    // Send notification to each supervisor
    for (const supervisor of supervisors) {
      await this.mailService.sendLeaveRequestToSupervisor(
        staff,
        supervisor,
        createDto.leaveType,
        createDto.startDate,
        createDto.endDate,
      );
    }

    // Item 8: Send notification to handover staff
    try {
      await this.mailService.sendLeaveHandoverNotification(
        handoverStaff,
        staff,
        createDto.leaveType,
        createDto.startDate,
        createDto.endDate,
      );
    } catch (mailErr) {
      console.error('Failed to send handover notification mail:', mailErr);
    }

    // Send notification to staff (confirmation)
    await this.mailService.sendLeaveSubmissionConfirmation(
      staff,
      createDto.leaveType,
      createDto.startDate,
      createDto.endDate,
    );

    // Send Push Notifications to handover staff, supervisors, and CEOs
    try {
      const ceos = await this.staffRepo.find({ where: { isCeo: true } });
      const ceoIds = ceos.map(c => c.id);
      const recipientIds = [
        createDto.handoverStaffId,
        ...supervisors.map((s) => s.id),
        ...ceoIds,
      ].filter(id => id !== staffId);

      const title = 'New Leave Request Submitted';
      const body = `${staff.firstName} ${staff.lastName} has submitted a leave request (${createDto.leaveType}) from ${createDto.startDate} to ${createDto.endDate}.`;
      await this.sendPushNotificationToUsers(recipientIds, title, body);
    } catch (pushErr) {
      console.error('Failed to send create leave request push notifications:', pushErr);
    }

    return savedRequest;
  }

  async findAllForUser(staffId: number, search?: string, status?: string) {
    const query = this.leaveRequestRepo
      .createQueryBuilder('leaveRequest')
      .leftJoinAndSelect('leaveRequest.staff', 'staff')
      .leftJoinAndSelect('leaveRequest.supervisors', 'supervisors')
      .leftJoinAndSelect('leaveRequest.handoverStaff', 'handoverStaff')
      .leftJoinAndSelect('leaveRequest.reviewedBy', 'reviewedBy')
      .where('leaveRequest.staffId = :staffId', { staffId });

    if (search) {
      query.andWhere(
        '(CAST(leaveRequest.leaveType AS TEXT) ILIKE :search OR leaveRequest.reason ILIKE :search OR CAST(leaveRequest.status AS TEXT) ILIKE :search OR supervisors.firstName ILIKE :search OR supervisors.lastName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status && status !== 'All') {
      query.andWhere('leaveRequest.status = :status', { status });
    }

    return query.orderBy('leaveRequest.submittedAt', 'DESC').getMany();
  }

  async findOne(id: string) {
    const request = await this.leaveRequestRepo.findOne({
      where: { id },
      relations: ['staff', 'supervisors', 'handoverStaff', 'reviewedBy'],
    });

    if (!request) throw new NotFoundException('Leave request not found');
    return request;
  }

  async update(id: string, updateDto: Partial<CreateLeaveRequestDto>, staffId: number, file?: Express.Multer.File) {
    const request = await this.leaveRequestRepo.findOne({
      where: { id, staffId },
      relations: ['supervisors', 'staff', 'handoverStaff'],
    });

    if (!request) throw new NotFoundException('Leave request not found or not authorized');

    if (file) {
      const s3File = file as Express.Multer.File & { location: string };
      request.attachedDocument = s3File.location;
    }

    if (updateDto.supervisorIds) {
      const supervisors = await this.staffRepo.find({
        where: { id: In(updateDto.supervisorIds) },
      });
      request.supervisors = supervisors;
    }

    if (updateDto.startDate || updateDto.endDate) {
      const start = dayjs(updateDto.startDate || request.startDate);
      const end = dayjs(updateDto.endDate || request.endDate);
      request.durationDays = end.diff(start, 'day') + 1;

      if (request.durationDays <= 0) {
        throw new BadRequestException('End date must be after or equal to start date');
      }
    }

    Object.assign(request, {
      ...updateDto,
      supervisorIds: undefined, // Handled separately
    });

    const saved = await this.leaveRequestRepo.save(request);

    // Item 7: Notify supervisors that the leave request was edited
    try {
      const staffMember = await this.staffRepo.findOne({
        where: { id: staffId },
        relations: ['employment'],
      });

      if (staffMember && request.supervisors?.length > 0) {
        for (const supervisor of request.supervisors) {
          await this.mailService.sendLeaveEditNotificationToSupervisor(
            staffMember,
            supervisor,
            updateDto.leaveType || request.leaveType,
            updateDto.startDate || request.startDate,
            updateDto.endDate || request.endDate,
          );
        }
      }
    } catch (mailErr) {
      console.error('Failed to send edit notification to supervisors:', mailErr);
    }

    // Send Push Notifications to handover staff, supervisors, and CEOs
    try {
      const ceos = await this.staffRepo.find({ where: { isCeo: true } });
      const ceoIds = ceos.map(c => c.id);
      const currentHandoverStaffId = updateDto.handoverStaffId || request.handoverStaffId;
      const currentSupervisors = request.supervisors || [];
      const recipientIds = [
        currentHandoverStaffId,
        ...currentSupervisors.map((s) => s.id),
        ...ceoIds,
      ].filter(id => id !== staffId);

      const staffName = request.staff
        ? `${request.staff.firstName} ${request.staff.lastName}`
        : 'A staff member';
      const title = 'Leave Request Updated';
      const body = `${staffName} has updated their leave request (${request.leaveType}) from ${request.startDate} to ${request.endDate}.`;
      await this.sendPushNotificationToUsers(recipientIds, title, body);
    } catch (pushErr) {
      console.error('Failed to send update leave request push notifications:', pushErr);
    }

    return saved;
  }

  async updateStatus(id: string, updateDto: UpdateLeaveStatusDto, adminId: number) {
    const request = await this.leaveRequestRepo.findOne({
      where: { id },
      relations: ['staff'],
    });

    if (!request) throw new NotFoundException('Leave request not found');

    request.status = updateDto.status;
    request.reviewNotes = updateDto.reviewNotes ?? '';
    request.reviewedAt = new Date();
    request.reviewedById = adminId;

    const saved = await this.leaveRequestRepo.save(request);

    // Send notification to staff/
    await this.mailService.sendLeaveStatusUpdate(
      request.staff,
      updateDto.status,
      updateDto.reviewNotes ?? '',
    );

    // Send Push Notifications to applying staff member and CEOs
    try {
      const ceos = await this.staffRepo.find({ where: { isCeo: true } });
      const ceoIds = ceos.map(c => c.id);
      const recipientIds = [
        request.staffId,
        ...ceoIds,
      ];

      const applicantTitle = 'Leave Request Status Updated';
      const applicantBody = `Your leave request has been ${updateDto.status}.`;

      const ceoTitle = 'Leave Request Status Updated';
      const ceoBody = `The leave request for ${request.staff.firstName} ${request.staff.lastName} has been ${updateDto.status}.`;

      const uniqueUserIds = Array.from(new Set(recipientIds.filter(id => id && id > 0)));
      for (const userId of uniqueUserIds) {
        const isApplicant = userId === request.staffId;
        const title = isApplicant ? applicantTitle : ceoTitle;
        const body = isApplicant ? applicantBody : ceoBody;
        try {
          await this.pushNotificationService.sendNotification(userId, {
            title,
            body,
            url: '/leave-management',
            type: 'leave-request',
          });
        } catch (err) {
          console.error(`Failed to send push notification to user ${userId}:`, err);
        }
      }
    } catch (pushErr) {
      console.error('Failed to send status update push notifications:', pushErr);
    }

    return saved;
  }

  async findAllForSupervisor(supervisorId: number, search?: string) {
    const query = this.leaveRequestRepo
      .createQueryBuilder('leaveRequest')
      .leftJoinAndSelect('leaveRequest.staff', 'staff')
      .leftJoinAndSelect('leaveRequest.supervisors', 'supervisors')
      .leftJoinAndSelect('leaveRequest.handoverStaff', 'handoverStaff')
      .where('supervisors.id = :supervisorId', { supervisorId });

    if (search) {
      query.andWhere(
        '(CAST(leaveRequest.leaveType AS TEXT) ILIKE :search OR leaveRequest.reason ILIKE :search OR CAST(leaveRequest.status AS TEXT) ILIKE :search OR staff.firstName ILIKE :search OR staff.lastName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    return query.orderBy('leaveRequest.submittedAt', 'DESC').getMany();
  }

  async getSupervisorStats(supervisorId: number) {
    const requests = await this.leaveRequestRepo
      .createQueryBuilder('leaveRequest')
      .leftJoin('leaveRequest.supervisors', 'supervisors')
      .where('supervisors.id = :supervisorId', { supervisorId })
      .getMany();

    return {
      total: requests.length,
      pending: requests.filter(r => r.status === LeaveStatus.PENDING).length,
      approved: requests.filter(r => r.status === LeaveStatus.APPROVED).length,
      declined: requests.filter(r => r.status === LeaveStatus.DECLINED).length,
      cancelled: requests.filter(r => r.status === LeaveStatus.CANCELLED).length,
      completed: requests.filter(r => r.status === LeaveStatus.COMPLETED).length,
    };
  }

  async isSupervisor(staffId: number): Promise<boolean> {
    const found = await this.leaveRequestRepo
      .createQueryBuilder('leaveRequest')
      .leftJoin('leaveRequest.supervisors', 'supervisors')
      .where('supervisors.id = :staffId', { staffId })
      .getOne();
    return !!found;
  }

  async findSupervisorMe(staffId: number, search?: string, status?: string) {
    const supervisorExists = await this.isSupervisor(staffId);

    if (!supervisorExists) {
      throw new NotFoundException('You are not a supervisor for any leave requests');
    }

    const query = this.leaveRequestRepo
      .createQueryBuilder('leaveRequest')
      .leftJoinAndSelect('leaveRequest.staff', 'staff')
      .leftJoinAndSelect('leaveRequest.supervisors', 'supervisors')
      .leftJoinAndSelect('leaveRequest.handoverStaff', 'handoverStaff')
      .leftJoinAndSelect('leaveRequest.reviewedBy', 'reviewedBy')
      .where('supervisors.id = :staffId', { staffId });

    if (search) {
      query.andWhere(
        '(CAST(leaveRequest.leaveType AS TEXT) ILIKE :search OR leaveRequest.reason ILIKE :search OR CAST(leaveRequest.status AS TEXT) ILIKE :search OR staff.firstName ILIKE :search OR staff.lastName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status && status !== 'All') {
      query.andWhere('leaveRequest.status = :status', { status });
    }

    return query.orderBy('leaveRequest.submittedAt', 'DESC').getMany();
  }

  async findAllForAdmin(search?: string) {
    const query = this.leaveRequestRepo
      .createQueryBuilder('leaveRequest')
      .leftJoinAndSelect('leaveRequest.staff', 'staff')
      .leftJoinAndSelect('leaveRequest.supervisors', 'supervisors')
      .leftJoinAndSelect('leaveRequest.handoverStaff', 'handoverStaff')
      .leftJoinAndSelect('leaveRequest.reviewedBy', 'reviewedBy');

    if (search) {
      query.andWhere(
        '(CAST(leaveRequest.leaveType AS TEXT) ILIKE :search OR leaveRequest.reason ILIKE :search OR CAST(leaveRequest.status AS TEXT) ILIKE :search OR staff.firstName ILIKE :search OR staff.lastName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    return query.orderBy('leaveRequest.submittedAt', 'DESC').getMany();
  }

  async getAdminStats() {
    const requests = await this.leaveRequestRepo.find();

    return {
      total: requests.length,
      pending: requests.filter(r => r.status === LeaveStatus.PENDING).length,
      approved: requests.filter(r => r.status === LeaveStatus.APPROVED).length,
      declined: requests.filter(r => r.status === LeaveStatus.DECLINED).length,
      cancelled: requests.filter(r => r.status === LeaveStatus.CANCELLED).length,
      completed: requests.filter(r => r.status === LeaveStatus.COMPLETED).length,
    };
  }

  async getStats(staffId: number) {
    const requests = await this.leaveRequestRepo.find({ where: { staffId } });

    return {
      total: requests.length,
      pending: requests.filter(r => r.status === LeaveStatus.PENDING).length,
      approved: requests.filter(r => r.status === LeaveStatus.APPROVED).length,
      declined: requests.filter(r => r.status === LeaveStatus.DECLINED).length,
      cancelled: requests.filter(r => r.status === LeaveStatus.CANCELLED).length,
      completed: requests.filter(r => r.status === LeaveStatus.COMPLETED).length,
    };
  }
  ///helper ///
  private async sendPushNotificationToUsers(
    userIds: number[],
    title: string,
    body: string,
  ) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(id => id && id > 0)));
    for (const userId of uniqueUserIds) {
      try {
        await this.pushNotificationService.sendNotification(userId, {
          title,
          body,
          url: '/leave-management',
          type: 'leave-request',
        });
      } catch (err) {
        console.error(`Failed to send push notification to user ${userId}:`, err);
      }
    }
  }
}
