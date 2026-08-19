import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { Quote } from './entities/quote.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, ILike, Repository } from 'typeorm';
import { Admin } from 'src/admin/entities/admin.entity';
import { GetQuoteDto } from './dto/getQuote.dto';
import * as moment from 'moment-timezone';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

@Injectable()
export class QuoteService {
  constructor(
    @InjectRepository(Quote)
    private readonly quoteRepo: Repository<Quote>,

    @InjectRepository(Admin)
    private readonly adminRepo: Repository<Admin>,

    @InjectRepository(Staff)
    private readonly staffRepo: Repository<Staff>,
  ) {}
  async create(
    createQuoteDto: CreateQuoteDto,
    adminId: number,
    file?: Express.Multer.File,
  ): Promise<Quote> {
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');

    //  STEP 1: Check for any staff birthday or anniversary today
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // JS months are 0-based
    const todayDay = today.getDate();

    // Fetch all staff (you can optimize this by adding a custom query)
    const allStaff = await this.staffRepo.find({
      relations: ['employment'],
    });

    // Flag for birthday or anniversary match
    let celebrant: any = null;

    for (const staff of allStaff) {
      // Check Birthday match (month + day)
      if (staff.dateOfBirth) {
        const dob = new Date(staff.dateOfBirth);
        if (dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay) {
          celebrant = `${staff.firstName} ${staff.lastName} (Birthday)`;
          break;
        }
      }

      // Check Hire Anniversary match (month + day)
      if (staff.employment?.hireDate) {
        const hire = new Date(staff.employment.hireDate);
        if (hire.getMonth() + 1 === todayMonth && hire.getDate() === todayDay) {
          celebrant = `${staff.firstName} ${staff.lastName} (Work Anniversary)`;
          break;
        }
      }
    }

    if (celebrant) {
      throw new BadRequestException(
        `We have a staff celebrating ${celebrant} today. Admin cannot create a quote or file.`,
      );
    }
    const wordCount =
      createQuoteDto.description?.trim().split(/\s+/).length || 0;
    if (wordCount > 500) {
      throw new BadRequestException('Description cannot exceed 500 words');
    }
    if (file) {
      const s3File = file as Express.Multer.File & { location?: string };
      if (s3File.location) {
        // Add uploaded video URL to array
        createQuoteDto.fileUrl = createQuoteDto.fileUrl
          ? [...createQuoteDto.fileUrl, s3File.location]
          : [s3File.location];
      } else {
        throw new BadRequestException(
          'File upload to S3 failed: location missing',
        );
      }
    }
    const quote = this.quoteRepo.create({
      subject: createQuoteDto.subject,
      description: createQuoteDto.description,
      fileUrl: createQuoteDto.fileUrl || [],
      createdBy: admin,
    });

    const savedQuote = await this.quoteRepo.save(quote);

    return savedQuote;
  }

  async findAll(query: GetQuoteDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = query.search ? query.search.trim() : null;

    const where = search
      ? [
          { subject: ILike(`%${search}%`) },
          { description: ILike(`%${search}%`) },
        ]
      : {};

    const [data, total] = await this.quoteRepo.findAndCount({
      where,
      take: limit,
      skip,
      order: { createdAt: 'DESC' },
      relations: ['createdBy'],
    });

    return {
      data,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getQuotesForToday(): Promise<Quote[]> {
    // Get current date in Nigeria timezone (Africa/Lagos)
    const nigeriaTime = moment().tz('Africa/Lagos');

    // Define start and end of the day in Nigeria time
    const startOfDay = nigeriaTime.clone().startOf('day').toDate();
    const endOfDay = nigeriaTime.clone().endOf('day').toDate();

    // Fetch all quotes created today
    return await this.quoteRepo.find({
      where: {
        createdAt: Between(startOfDay, endOfDay),
      },
      order: { createdAt: 'DESC' },
    });
  }
  /**  Get one announcement by ID */
  async findOne(id: string): Promise<Quote> {
    const quote = await this.quoteRepo.findOne({
      where: { id },
      relations: ['createdBy'],
    });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }
  async update(
    id: string,
    updateQuoteDto: CreateQuoteDto,
    adminId: number,
    file?: Express.Multer.File,
  ): Promise<Quote> {
    // Check if admin exists
    const admin = await this.adminRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin not found');

    // Check if quote exists
    const existingQuote = await this.quoteRepo.findOne({ where: { id } });
    if (!existingQuote) throw new NotFoundException('Quote not found');

    //  STEP 1: Check for any staff birthday or anniversary today
    const today = new Date();
    const todayMonth = today.getMonth() + 1; // JS months are 0-based
    const todayDay = today.getDate();

    // Fetch all staff (you can optimize this by adding a custom query)
    const allStaff = await this.staffRepo.find({
      relations: ['employment'],
    });

    // Flag for birthday or anniversary match
    let celebrant: any = null;

    for (const staff of allStaff) {
      // Check Birthday match (month + day)
      if (staff.dateOfBirth) {
        const dob = new Date(staff.dateOfBirth);
        if (dob.getMonth() + 1 === todayMonth && dob.getDate() === todayDay) {
          celebrant = `${staff.firstName} ${staff.lastName} (Birthday)`;
          break;
        }
      }

      // Check Hire Anniversary match (month + day)
      if (staff.employment?.hireDate) {
        const hire = new Date(staff.employment.hireDate);
        if (hire.getMonth() + 1 === todayMonth && hire.getDate() === todayDay) {
          celebrant = `${staff.firstName} ${staff.lastName} (Work Anniversary)`;
          break;
        }
      }
    }

    if (celebrant) {
      throw new BadRequestException(
        `We have a staff celebrating ${celebrant} today. Admin cannot create a quote or file.`,
      );
    }

    // Validate word limit for description
    const wordCount =
      updateQuoteDto.description?.trim().split(/\s+/).length || 0;
    if (wordCount > 500) {
      throw new BadRequestException('Description cannot exceed 500 words');
    }
    if (file) {
      const s3File = file as Express.Multer.File & { location?: string };
      if (s3File.location) {
        existingQuote.fileUrl = existingQuote.fileUrl
          ? [...existingQuote.fileUrl, s3File.location]
          : [s3File.location];
      } else {
        throw new BadRequestException(
          'File upload to S3 failed: location missing',
        );
      }
    }
    // Update the quote
    existingQuote.subject = updateQuoteDto.subject ?? existingQuote.subject;
    existingQuote.description =
      updateQuoteDto.description ?? existingQuote.description;
    ((existingQuote.fileUrl = updateQuoteDto.fileUrl || []),
      (existingQuote.createdBy = admin)); // optional: update who modified it

    const updatedQuote = await this.quoteRepo.save(existingQuote);
    return updatedQuote;
  }

  /**  Delete an announcement */
  async remove(id: string): Promise<{ message: string }> {
    const announcement = await this.findOne(id);
    await this.quoteRepo.remove(announcement);
    return {
      message: 'Quote deleted successfully',
    };
  }
}
