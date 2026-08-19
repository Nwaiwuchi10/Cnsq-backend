import { Test, TestingModule } from '@nestjs/testing';
import { DocumentationService } from './documentation.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Documentation } from './entities/documentation.entity';
import { Staff } from 'src/staff-register/entities/staff-register.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateDocumentationDto } from './dto/create-documentation.dto';

describe('DocumentationService', () => {
  let service: DocumentationService;
  const mockDocumentationRepo = {
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };
  const mockStaffRepo = {
    findOne: jest.fn(),
  };
  const mockAdminRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentationService,
        {
          provide: getRepositoryToken(Documentation),
          useValue: mockDocumentationRepo,
        },
        {
          provide: getRepositoryToken(Staff),
          useValue: mockStaffRepo,
        },
        {
          provide: getRepositoryToken(Admin),
          useValue: mockAdminRepo,
        },
      ],
    }).compile();

    service = module.get<DocumentationService>(DocumentationService);
    jest.clearAllMocks();
  });

  describe('checkProjectManagerOrAdmin', () => {
    it('should throw BadRequestException if neither admin nor PM', async () => {
      mockAdminRepo.findOne.mockResolvedValue(null);
      mockStaffRepo.findOne.mockResolvedValue({ id: 1, roles: [{ name: 'Developer' }] });

      // Note: we can test this indirectly through create
      await expect(service.create({ name: 'test' } as any, 1, []))
        .rejects.toThrow(BadRequestException);
    });

    it('should pass if admin', async () => {
      mockAdminRepo.findOne.mockResolvedValue({ id: 1, isAdmin: true });
      mockDocumentationRepo.create.mockReturnValue({});
      mockDocumentationRepo.save.mockResolvedValue({});

      await expect(service.create({ name: 'test' } as any, 1, []))
        .resolves.toBeDefined();
    });

    it('should pass if Project Manager', async () => {
        mockAdminRepo.findOne.mockResolvedValue(null);
        mockStaffRepo.findOne.mockResolvedValue({ id: 1, roles: [{ name: 'Project Manager' }] });
        mockDocumentationRepo.create.mockReturnValue({});
        mockDocumentationRepo.save.mockResolvedValue({});
  
        await expect(service.create({ name: 'test' } as any, 1, []))
          .resolves.toBeDefined();
      });
  });

  describe('create', () => {
    it('should successfully create documentation', async () => {
      mockAdminRepo.findOne.mockResolvedValue({ id: 1, isAdmin: true });
      const dto: CreateDocumentationDto = { name: 'API Docs', link: 'http://example.com' };
      const files = ['s3-url-1'];
      mockDocumentationRepo.create.mockReturnValue({ ...dto, files });
      mockDocumentationRepo.save.mockResolvedValue({ id: 'uuid-1', ...dto, files });

      const result = await service.create(dto, 1, files);
      expect(result).toHaveProperty('id', 'uuid-1');
      expect(result.files).toEqual(files);
      expect(result.name).toEqual('API Docs');
    });
  });

  describe('findAll', () => {
    it('should return paginated documentation list', async () => {
      const mockQueryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: '1', name: 'Test' }], 1]),
      };
      mockDocumentationRepo.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll(1, 10, 'search-term');

      expect(mockDocumentationRepo.createQueryBuilder).toHaveBeenCalledWith('doc');
      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
      expect(result).toEqual({ data: [{ id: '1', name: 'Test' }], total: 1, page: 1, limit: 10 });
    });
  });

  describe('findOne', () => {
    it('should return documentation if found', async () => {
      const doc = { id: 'uuid-1', name: 'Doc' };
      mockDocumentationRepo.findOne.mockResolvedValue(doc);

      const result = await service.findOne('uuid-1');
      expect(result).toEqual(doc);
    });

    it('should throw NotFoundException if not found', async () => {
      mockDocumentationRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('uuid-unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should successfully update documentation', async () => {
      mockAdminRepo.findOne.mockResolvedValue({ id: 1, isAdmin: true });
      const existingDoc = { id: 'uuid-1', name: 'Old', files: ['file1'] };
      mockDocumentationRepo.findOne.mockResolvedValue(existingDoc);
      mockDocumentationRepo.save.mockResolvedValue({ ...existingDoc, name: 'New', files: ['file1', 'file2'] });

      const result = await service.update('uuid-1', { name: 'New' }, 1, ['file2']);

      expect(result.name).toBe('New');
      expect(result.files).toEqual(['file1', 'file2']);
    });
  });

  describe('remove', () => {
    it('should successfully remove documentation', async () => {
      mockAdminRepo.findOne.mockResolvedValue({ id: 1, isAdmin: true });
      const existingDoc = { id: 'uuid-1', name: 'Old' };
      mockDocumentationRepo.findOne.mockResolvedValue(existingDoc);
      mockDocumentationRepo.remove.mockResolvedValue(existingDoc);

      const result = await service.remove('uuid-1', 1);

      expect(result).toEqual({ message: 'Documentation deleted successfully' });
      expect(mockDocumentationRepo.remove).toHaveBeenCalledWith(existingDoc);
    });
  });
});
