import { Test, TestingModule } from '@nestjs/testing';
import { QuoteController } from './quote.controller';
import { QuoteService } from './quote.service';
import { CanActivate } from '@nestjs/common';
import { UserAuthGuard } from '../admin/guard/auth.guard';

const mockQuoteService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

const mockGuard: CanActivate = {
  canActivate: jest.fn(() => true),
};

describe('QuoteController', () => {
  let controller: QuoteController;
  let service: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuoteController],
      providers: [
        {
          provide: QuoteService,
          useFactory: mockQuoteService,
        },
      ],
    })
      .overrideGuard(UserAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<QuoteController>(QuoteController);
    service = module.get<QuoteService>(QuoteService);
  });

  it('it should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a quote with file upload', async () => {
      const createQuoteDto = { content: 'Great quote', author: 'John' };
      const mockFile: any = {
        fieldname: 'file',
        originalname: 'quote.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 100,
        bucket: 'test',
        key: 'test-key',
        acl: 'public-read',
        contentType: 'text/plain',
        serverSideEncryption: undefined,
        storageClass: undefined,
        versionId: undefined,
        location: 'https://example.com/quote.txt',
      };

      service.create.mockResolvedValue({ id: 1, ...createQuoteDto });

      const result = await controller.create(
        mockFile,
        JSON.stringify(createQuoteDto),
        { userId: '1' },
      );
      expect(service.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all quotes', async () => {
      const quotes = [{ id: 1, content: 'Quote 1' }];
      service.findAll.mockResolvedValue(quotes);

      const result = await controller.findAll({ page: 1, limit: 10 });
      expect(result).toEqual(quotes);
    });
  });

  describe('findOne', () => {
    it('should return a single quote', async () => {
      const quote = { id: 1, content: 'Quote 1' };
      service.findOne.mockResolvedValue(quote);

      const result = await controller.findOne('1');
      expect(result).toEqual(quote);
    });
  });

  describe('remove', () => {
    it('should remove a quote', async () => {
      service.remove.mockResolvedValue({});
      await controller.remove('1');
      expect(service.remove).toHaveBeenCalled();
    });
  });
});
