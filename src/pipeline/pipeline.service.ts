import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PipelineIdea } from './entities/pipeline-idea.entity';
import { PipelineComment } from './entities/pipeline-comment.entity';
import { PipelineReaction } from './entities/pipeline-reaction.entity';
import { PipelineCommentReaction } from './entities/pipeline-comment-reaction.entity';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { Department } from '../departments/entities/department.entity';
import { NotificationService } from '../notification/notification.service';
import { PushNotificationService } from '../push-notification/push-notification.service';
import { NotificationType } from '../notification/entities/notification.entity';
import { CreatePipelineIdeaDto } from './dto/create-pipeline-idea.dto';
import { CreatePipelineCommentDto } from './dto/create-pipeline-comment.dto';

@Injectable()
export class PipelineService {
  constructor(
    @InjectRepository(PipelineIdea)
    private readonly ideaRepo: Repository<PipelineIdea>,
    @InjectRepository(PipelineComment)
    private readonly commentRepo: Repository<PipelineComment>,
    @InjectRepository(PipelineReaction)
    private readonly reactionRepo: Repository<PipelineReaction>,
    @InjectRepository(PipelineCommentReaction)
    private readonly commentReactionRepo: Repository<PipelineCommentReaction>,
    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    private readonly notificationService: NotificationService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  async createIdea(authorId: number, dto: CreatePipelineIdeaDto) {
    const author = await this.staffRepo.findOneBy({ id: authorId });
    if (!author) throw new NotFoundException('Author not found');

    const count = await this.ideaRepo.count();
    const pipeRef = `PIPE-${String(count + 1).padStart(3, '0')}`;

    const idea = new PipelineIdea();
    idea.pipeRef = pipeRef;
    idea.title = dto.title;
    idea.description = dto.description;
    idea.author = author;
    
    if (dto.attachments && dto.attachments.length > 0) {
      idea.attachments = dto.attachments;
    }

    if (dto.departmentId) {
      const department = await this.departmentRepo.findOneBy({ id: dto.departmentId });
      if (department) {
        idea.department = department;
      }
    }

    const savedIdea = await this.ideaRepo.save(idea);

    // If assigned to department, notify department members
    if (dto.departmentId) {
      this.notifyDepartmentMembers(dto.departmentId, savedIdea);
    }

    return savedIdea;
  }

  private async notifyDepartmentMembers(departmentId: number, idea: PipelineIdea) {
    try {
      const staffMembers = await this.staffRepo.find({
        where: { employment: { department: { id: departmentId } } },
        relations: ['employment', 'employment.department'],
      });

      const recipients = staffMembers.filter(s => s.id !== idea.author.id); // exclude author

      if (recipients.length > 0) {
        await this.notificationService.createNotificationsForStaffs(
          recipients,
          NotificationType.PIPELINE,
          'New Pipeline Idea',
          `A new idea "${idea.title}" was created for your department.`,
          undefined, undefined, undefined, undefined, undefined,
          idea.id
        );

        // Also push notifications
        for (const recipient of recipients) {
          await this.pushNotificationService.sendNotification(
            recipient.id,
            {
              title: 'New Pipeline Idea',
              body: `A new idea "${idea.title}" was created for your department.`,
            }
          );
        }
      }
    } catch (err) {
      console.error('Error notifying department members for pipeline idea:', err);
    }
  }

  async findAllIdeas(query: string, departmentId: string, limit: number, offset: number) {
    const qb = this.ideaRepo.createQueryBuilder('idea')
      .leftJoinAndSelect('idea.author', 'author')
      .leftJoinAndSelect('idea.department', 'department')
      .leftJoinAndSelect('idea.reactions', 'reactions')
      .leftJoinAndSelect('idea.comments', 'comments');

    if (query) {
      qb.andWhere('LOWER(idea.title) LIKE LOWER(:query)', { query: `%${query}%` });
    }

    if (departmentId) {
      qb.andWhere('idea.department.id = :departmentId', { departmentId: +departmentId });
    }

    qb.orderBy('idea.createdAt', 'DESC');
    qb.take(limit);
    qb.skip(offset);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      total,
      limit,
      offset,
    };
  }

  async updateIdea(id: string, authorId: number, dto: Partial<CreatePipelineIdeaDto>) {
    const idea = await this.ideaRepo.findOne({ where: { id }, relations: ['author', 'department'] });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.author.id !== authorId) throw new BadRequestException('Only the creator can edit this idea');

    if (dto.title) idea.title = dto.title;
    if (dto.description) idea.description = dto.description;
    
    if (dto.departmentId !== undefined) {
      if (dto.departmentId === null) {
        idea.department = null as any;
      } else {
        const department = await this.departmentRepo.findOneBy({ id: dto.departmentId });
        if (department) idea.department = department;
      }
    }

    if (dto.attachments && dto.attachments.length > 0) {
      idea.attachments = dto.attachments;
    }

    return await this.ideaRepo.save(idea);
  }

  async deleteIdea(id: string, authorId: number) {
    const idea = await this.ideaRepo.findOne({ where: { id }, relations: ['author'] });
    if (!idea) throw new NotFoundException('Idea not found');
    if (idea.author.id !== authorId) throw new BadRequestException('Only the creator can delete this idea');

    await this.ideaRepo.remove(idea);
    return { success: true, message: 'Idea deleted successfully' };
  }

  async findOneIdea(id: string) {
    const idea = await this.ideaRepo.createQueryBuilder('idea')
      .leftJoinAndSelect('idea.author', 'author')
      .leftJoinAndSelect('idea.department', 'department')
      .leftJoinAndSelect('idea.reactions', 'reactions')
      .leftJoinAndSelect('reactions.author', 'reactionAuthor')
      .leftJoinAndSelect('idea.comments', 'comments')
      .leftJoinAndSelect('comments.author', 'commentAuthor')
      .leftJoinAndSelect('comments.reactions', 'commentReactions')
      .leftJoinAndSelect('commentReactions.author', 'commentReactionAuthor')
      .leftJoinAndSelect('comments.parentComment', 'parentComment')
      .where('idea.id = :id', { id })
      .orderBy('comments.createdAt', 'ASC')
      .getOne();

    if (!idea) {
      throw new NotFoundException('Idea not found');
    }

    return idea;
  }

  async reactToIdea(ideaId: string, authorId: number, emoji: string) {
    const idea = await this.ideaRepo.findOneBy({ id: ideaId });
    if (!idea) throw new NotFoundException('Idea not found');

    const author = await this.staffRepo.findOneBy({ id: authorId });
    if (!author) throw new NotFoundException('Author not found');

    let reaction = await this.reactionRepo.findOne({
      where: { idea: { id: ideaId }, author: { id: authorId }, emoji }
    });

    if (reaction) {
      await this.reactionRepo.remove(reaction);
      return { status: 'removed' };
    } else {
      reaction = new PipelineReaction();
      reaction.idea = idea;
      reaction.author = author;
      reaction.emoji = emoji;
      await this.reactionRepo.save(reaction);
      return { status: 'added', reaction };
    }
  }

  async addComment(ideaId: string, authorId: number, dto: CreatePipelineCommentDto) {
    const idea = await this.ideaRepo.findOne({ where: { id: ideaId }, relations: ['author'] });
    if (!idea) throw new NotFoundException('Idea not found');

    const author = await this.staffRepo.findOneBy({ id: authorId });
    if (!author) throw new NotFoundException('Author not found');

    const comment = new PipelineComment();
    comment.content = dto.content;
    comment.idea = idea;
    comment.author = author;

    if (dto.attachments && dto.attachments.length > 0) {
      comment.attachments = dto.attachments;
    }

    if (dto.parentCommentId) {
      const parent = await this.commentRepo.findOneBy({ id: dto.parentCommentId });
      if (parent) {
        comment.parentComment = parent;
      }
    }

    const savedComment = await this.commentRepo.save(comment);
    
    await this.handleMentions(savedComment, idea);

    return savedComment;
  }

  private async handleMentions(comment: PipelineComment, idea: PipelineIdea) {
    // Regex to match @FirstName LastName
    const mentionRegex = /@([A-Z][a-z]+)\s+([A-Z][a-z]+)/g;
    let match;
    const mentionedNames: { first: string, last: string }[] = [];

    while ((match = mentionRegex.exec(comment.content)) !== null) {
      mentionedNames.push({ first: match[1], last: match[2] });
    }

    for (const name of mentionedNames) {
      const staff = await this.staffRepo.findOne({
        where: { firstName: name.first, lastName: name.last }
      });

      if (staff && staff.id !== comment.author.id) {
        await this.notificationService.createNotificationForStaff(
          staff,
          NotificationType.PIPELINE_TAG,
          'You were mentioned in a Pipeline Idea',
          `${comment.author.firstName} mentioned you in a comment on "${idea.title}".`,
          undefined, undefined, undefined, undefined, undefined,
          idea.id
        );
        await this.pushNotificationService.sendNotification(
          staff.id,
          {
            title: 'Pipeline Mention',
            body: `${comment.author.firstName} mentioned you on "${idea.title}".`
          }
        );
      }
    }
  }

  async reactToComment(commentId: string, authorId: number, emoji: string) {
    const comment = await this.commentRepo.findOneBy({ id: commentId });
    if (!comment) throw new NotFoundException('Comment not found');

    const author = await this.staffRepo.findOneBy({ id: authorId });
    if (!author) throw new NotFoundException('Author not found');

    let reaction = await this.commentReactionRepo.findOne({
      where: { comment: { id: commentId }, author: { id: authorId }, emoji }
    });

    if (reaction) {
      await this.commentReactionRepo.remove(reaction);
      return { status: 'removed' };
    } else {
      reaction = new PipelineCommentReaction();
      reaction.comment = comment;
      reaction.author = author;
      reaction.emoji = emoji;
      await this.commentReactionRepo.save(reaction);
      return { status: 'added', reaction };
    }
  }
}
