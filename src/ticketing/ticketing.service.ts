import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus, TicketPriority } from './entities/ticket.entity';
import { TicketActivity } from './entities/ticket-activity.entity';
import { Department } from 'src/departments/entities/department.entity';
import { HeadOfDepartment } from 'src/headofdepartment/entities/headofdepartment.entity';
import { NotificationService } from 'src/notification/notification.service';
import { NotificationType } from 'src/notification/entities/notification.entity';
import { PushNotificationService } from 'src/push-notification/push-notification.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketStatusDto } from './dto/update-ticket-status.dto';
import { AddTicketCommentDto } from './dto/add-comment.dto';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { TicketingMailService } from './services/mail.service';

@Injectable()
export class TicketingService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketActivity)
    private readonly activityRepo: Repository<TicketActivity>,
    @InjectRepository(Department)
    private readonly deptRepo: Repository<Department>,
    @InjectRepository(HeadOfDepartment)
    private readonly hodRepo: Repository<HeadOfDepartment>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    private readonly notificationService: NotificationService,
    private readonly pushNotificationService: PushNotificationService,
    private readonly mailService: TicketingMailService,
  ) { }

  private async generateTicketRef(): Promise<string> {
    const count = await this.ticketRepo.count();
    const nextId = count + 1;
    return `TKT-${nextId.toString().padStart(3, '0')}`;
  }

  async createTicket(creatorId: number, dto: CreateTicketDto) {
    const department = await this.deptRepo.findOne({ where: { id: dto.departmentId } });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const ticketRef = await this.generateTicketRef();

    const ticket = this.ticketRepo.create({
      ticketRef,
      subject: dto.subject,
      description: dto.description,
      priority: dto.priority,
      departmentId: department.id,
      creatorId,
      attachments: dto.attachments || [],
      status: TicketStatus.OPEN,
      linkedProjectId: dto.linkedProjectId,
      linkedTaskId: dto.linkedTaskId,
    });

    const savedTicket = await this.ticketRepo.save(ticket);

    // Initial activity log
    const activity = this.activityRepo.create({
      ticketId: savedTicket.id,
      content: `Ticket created and assigned to ${department.name}.`,
      isSystemActivity: true,
      authorId: creatorId,
    });
    await this.activityRepo.save(activity);

    // Notify HOD
    const hod = await this.hodRepo.findOne({ where: { department: { id: department.id } }, relations: ['staff'] });
    if (hod && hod.staff) {
      await this.notificationService.createNotificationForStaff(
        hod.staff,
        NotificationType.ASSIGNMENT,
        'New Department Ticket',
        `A new ticket (${ticketRef}) has been submitted to your department.`
      );
      await this.pushNotificationService.sendNotification(hod.staff.id, {
        title: 'New Department Ticket',
        body: `A new ticket (${ticketRef}) has been submitted to your department.`,
        url: `/ticketing/${ticketRef}`,
      });
      const creator = await this.staffRepo.findOne({ where: { id: creatorId } });
      const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'A user';
      await this.mailService.sendTicketCreatedMail(hod.staff, savedTicket, creatorName);
    }

    return savedTicket;
  }

  async getTicketsForUser(
    userId: number,
    myPageNum: number = 1,
    myPageSize: number = 10,
    mySearch: string = '',
    receivedPageNum: number = 1,
    receivedPageSize: number = 10,
    receivedSearch: string = '',
    allPageNum: number = 1,
    allPageSize: number = 10,
    allSearch: string = '',
  ) {
    // A user sees tickets they created.
    // If they are an HOD, they also see tickets assigned to their department.

    let createdTickets = await this.ticketRepo.find({
      where: { creatorId: userId },
      relations: ['department', 'creator'],
      order: { createdAt: 'DESC' },
    });

    let allTickets = await this.ticketRepo.find({
      relations: ['department', 'creator'],
      order: { createdAt: 'DESC' },
    });

    // Check if user is HOD
    const hodDepartments = await this.hodRepo.find({ where: { staff: { id: userId } }, relations: ['department'] });
    let receivedTickets: Ticket[] = [];

    if (hodDepartments.length > 0) {
      const deptIds = hodDepartments.map(h => h.department.id);
      receivedTickets = await this.ticketRepo.createQueryBuilder('ticket')
        .leftJoinAndSelect('ticket.department', 'department')
        .leftJoinAndSelect('ticket.creator', 'creator')
        .where('ticket.departmentId IN (:...deptIds)', { deptIds })
        // Exclude tickets they created to avoid duplicates in 'received' tab, or keep them. We'll keep them as they belong to the dept.
        .orderBy('ticket.createdAt', 'DESC')
        .getMany();
    }

    // Helper function for search filtering
    const filterBySearch = (ticketList: Ticket[], searchTerm: string) => {
      if (!searchTerm.trim()) return ticketList;
      const lowerSearch = searchTerm.toLowerCase();
      return ticketList.filter(
        (t) =>
          t.subject.toLowerCase().includes(lowerSearch) ||
          t.description.toLowerCase().includes(lowerSearch) ||
          t.ticketRef.toLowerCase().includes(lowerSearch),
      );
    };

    // Helper function for pagination
    const paginate = (ticketList: Ticket[], pageNum: number, pageSize: number) => {
      const start = (pageNum - 1) * pageSize;
      const end = start + pageSize;
      const pagedData = ticketList.slice(start, end);
      return {
        data: pagedData,
        total: ticketList.length,
        pageNum: Number(pageNum),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(ticketList.length / pageSize),
      };
    };

    createdTickets = filterBySearch(createdTickets, mySearch);
    receivedTickets = filterBySearch(receivedTickets, receivedSearch);
    allTickets = filterBySearch(allTickets, allSearch);

    return {
      myTickets: paginate(createdTickets, myPageNum, myPageSize),
      receivedTickets: paginate(receivedTickets, receivedPageNum, receivedPageSize),
      allTickets: paginate(allTickets, allPageNum, allPageSize),
      isHod: hodDepartments.length > 0,
      currentUserId: userId,
    };
  }

  async getTicketStats(userId: number) {
    const { myTickets, receivedTickets, allTickets } = await this.getTicketsForUser(userId, 1, 999999, '', 1, 999999, '', 1, 999999, '');
    // Combine unique tickets by ID to calculate stats
    const allTicketsMap = new Map<string, Ticket>();
    allTickets.data.forEach(t => allTicketsMap.set(t.id, t));

    const allUnique = Array.from(allTicketsMap.values());

    return {
      total: allUnique.length,
      open: allUnique.filter(t => t.status === TicketStatus.OPEN).length,
      inProgress: allUnique.filter(t => t.status === TicketStatus.IN_PROGRESS).length,
      completed: allUnique.filter(t => t.status === TicketStatus.COMPLETED).length,
    };
  }

  async getTicketDetails(id: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['department', 'creator', 'activities', 'activities.author', 'linkedProject', 'linkedTask'],
      order: {
        activities: { createdAt: 'ASC' }
      }
    });

    if (!ticket) throw new NotFoundException('Ticket not found');

    // Attach current HOD to the response so frontend knows who it is assigned to
    const hod = await this.hodRepo.findOne({ where: { department: { id: ticket.departmentId } }, relations: ['staff'] });

    return {
      ...ticket,
      assignedHod: hod?.staff || null,
    };
  }

  async updateTicket(userId: number, id: string, dto: Partial<CreateTicketDto>) {
    const ticket = await this.ticketRepo.findOne({ where: { id }, relations: ['department', 'creator'] });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (ticket.creatorId !== userId) {
      throw new ForbiddenException('Only the ticket creator can edit this ticket.');
    }

    if (dto.departmentId && dto.departmentId !== ticket.departmentId) {
      const department = await this.deptRepo.findOne({ where: { id: dto.departmentId } });
      if (!department) throw new NotFoundException('Department not found');
      ticket.departmentId = department.id;
      ticket.department = department;
    }

    if (dto.subject) ticket.subject = dto.subject;
    if (dto.description) ticket.description = dto.description;
    if (dto.priority) ticket.priority = dto.priority as TicketPriority;
    
    // Merge new attachments if provided (assuming replacement)
    if (dto.attachments) {
      ticket.attachments = dto.attachments;
    }
    
    if (dto.linkedProjectId !== undefined) ticket.linkedProjectId = dto.linkedProjectId;
    if (dto.linkedTaskId !== undefined) ticket.linkedTaskId = dto.linkedTaskId;

    await this.ticketRepo.save(ticket);

    const activity = this.activityRepo.create({
      ticketId: ticket.id,
      content: `Ticket details were updated by the creator.`,
      isSystemActivity: true,
      authorId: userId,
    });
    await this.activityRepo.save(activity);

    return ticket;
  }

  async updateTicketStatus(userId: number, id: string, dto: UpdateTicketStatusDto) {
    const ticket = await this.ticketRepo.findOne({ where: { id }, relations: ['department', 'creator'] });
    if (!ticket) throw new NotFoundException('Ticket not found');

    // Only HOD of that department or Project Manager can change status to Completed
    const isHod = await this.hodRepo.findOne({
      where: { staff: { id: userId }, department: { id: ticket.departmentId } }
    });
    
    const staffUser = await this.staffRepo.findOne({ where: { id: userId }, relations: ['roles'] });
    const isProjectManager = staffUser?.roles?.some(r => r.name === 'Project Manager') || staffUser?.isCeo;

    if (!isHod && !isProjectManager && dto.status === TicketStatus.COMPLETED) {
      throw new ForbiddenException('Only the Head of Department or Project Manager can mark a ticket as completed.');
    }

    const oldStatus = ticket.status;
    ticket.status = dto.status;
    await this.ticketRepo.save(ticket);

    // Log activity
    const activity = this.activityRepo.create({
      ticketId: ticket.id,
      content: `Status updated from ${oldStatus} to ${dto.status}.`,
      isSystemActivity: true,
      authorId: userId,
    });
    await this.activityRepo.save(activity);

    if (ticket.creatorId !== userId && ticket.creator) {
      await this.notificationService.createNotificationForStaff(
        ticket.creator,
        NotificationType.STATUS_CHANGE,
        'Ticket Status Updated',
        `Your ticket ${ticket.ticketRef} status has been updated to ${dto.status}.`
      );
      
      // Send Mail
      await this.mailService.sendTicketStatusChangedMail(ticket.creator, ticket);
      
      // Send Push Notification
      try {
        await this.pushNotificationService.sendNotification(
          ticket.creator.id,
          {
            title: 'Ticket Status Updated',
            body: `Your ticket ${ticket.ticketRef} status has been updated to ${dto.status}.`,
            url: `/ticketing/${ticket.id}`
          }
        );
      } catch (e) {
        console.error('Push notification failed', e);
      }
    }

    return ticket;
  }

  async addTicketComment(userId: number, id: string, dto: AddTicketCommentDto) {
    const ticket = await this.ticketRepo.findOne({ where: { id }, relations: ['department', 'creator'] });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const activity = this.activityRepo.create({
      ticketId: ticket.id,
      content: dto.content,
      isSystemActivity: false,
      authorId: userId,
      attachments: dto.attachments || [],
    });

    const saved = await this.activityRepo.save(activity);

    // Notification logic
    const isHod = await this.hodRepo.findOne({ where: { staff: { id: userId }, department: { id: ticket.departmentId } } });

    // If HOD commented, notify creator
    if (isHod && ticket.creatorId !== userId) {
      await this.notificationService.createNotificationForStaff(
        ticket.creator,
        NotificationType.COMMENT,
        'New Comment on Ticket',
        `The HOD added a comment to your ticket (${ticket.ticketRef}).`
      );
      await this.pushNotificationService.sendNotification(ticket.creator.id, {
        title: 'New Comment on Ticket',
        body: `The HOD added a comment to your ticket (${ticket.ticketRef}).`,
        url: `/ticketing/${ticket.ticketRef}`,
      });
    }
    // If Creator commented, notify HOD
    else if (ticket.creatorId === userId) {
      const hod = await this.hodRepo.findOne({ where: { department: { id: ticket.departmentId } }, relations: ['staff'] });
      if (hod && hod.staff && hod.staff.id !== userId) {
        await this.notificationService.createNotificationForStaff(
          hod.staff,
          NotificationType.COMMENT,
          'New Comment on Ticket',
          `The creator added a comment to ticket ${ticket.ticketRef}.`
        );
        await this.pushNotificationService.sendNotification(hod.staff.id, {
          title: 'New Comment on Ticket',
          body: `The creator added a comment to ticket ${ticket.ticketRef}.`,
          url: `/ticketing/${ticket.ticketRef}`,
        });
      }
    }

    // Return the activity with author details
    return this.activityRepo.findOne({ where: { id: saved.id }, relations: ['author'] });
  }
}
