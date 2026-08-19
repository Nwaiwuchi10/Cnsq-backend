import { Test, TestingModule } from '@nestjs/testing';
import { QuoteService } from './quote.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Quote } from './entities/quote.entity';
import { Admin } from '../admin/entities/admin.entity';
import { Staff } from '../staff-register/entities/staff-register.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

describe('QuoteService', () => {
  let service: QuoteService;
  let quoteRepo: any;
  let adminRepo: any;
  let staffRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteService,
        { provide: getRepositoryToken(Quote), useFactory: mockRepository },
        { provide: getRepositoryToken(Admin), useFactory: mockRepository },
        { provide: getRepositoryToken(Staff), useFactory: mockRepository },
      ],
    }).compile();

    service = module.get<QuoteService>(QuoteService);
    quoteRepo = module.get(getRepositoryToken(Quote));
    adminRepo = module.get(getRepositoryToken(Admin));
    staffRepo = module.get(getRepositoryToken(Staff));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createQuoteDto = {
      subject: 'Quote Subject',
      description: 'Great quote description',
      fileUrl: [],
    };

    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should create a quote successfully', async () => {
      adminRepo.findOne.mockResolvedValue(admin);
      staffRepo.find.mockResolvedValue([]);
      quoteRepo.create.mockReturnValue(createQuoteDto);
      quoteRepo.save.mockResolvedValue(createQuoteDto);

      const result = await service.create(createQuoteDto, admin.id);

      expect(result.subject).toEqual(createQuoteDto.subject);
      expect(quoteRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if admin not found', async () => {
      adminRepo.findOne.mockResolvedValue(null);

      await expect(service.create(createQuoteDto, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return an array of quotes', async () => {
      const quotes = [
        { id: '1', subject: 'Quote 1' },
        { id: '2', subject: 'Quote 2' },
      ];
      quoteRepo.find.mockResolvedValue(quotes);

      const result = await service.findAll({ page: 0, limit: 10 });

      expect(result).toEqual(quotes);
    });
  });

  describe('findOne', () => {
    it('should return a single quote', async () => {
      const quote = { id: '1', subject: 'Quote 1' };
      quoteRepo.findOne.mockResolvedValue(quote);

      const result = await service.findOne('1');

      expect(result).toEqual(quote);
    });

    it('should throw NotFoundException if quote not found', async () => {
      quoteRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    const admin = {
      id: 1,
      isAdmin: true,
    };

    it('should remove a quote successfully', async () => {
      const quote = { id: '1', subject: 'Quote 1' };
      adminRepo.findOne.mockResolvedValue(admin);
      quoteRepo.findOne.mockResolvedValue(quote);
      quoteRepo.remove.mockResolvedValue({});

      const result = await service.remove('1');

      expect(result).toEqual({ message: expect.any(String) });
    });
  });
});
