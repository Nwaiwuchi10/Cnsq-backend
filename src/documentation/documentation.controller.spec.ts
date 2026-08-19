import { Test, TestingModule } from '@nestjs/testing';
import { DocumentationController } from './documentation.controller';
import { DocumentationService } from './documentation.service';
import { StaffOrAdminAuthGuard } from 'src/staff-register/guard/staff-admin-guard';
import { CreateDocumentationDto } from './dto/create-documentation.dto';

describe('DocumentationController', () => {
  let controller: DocumentationController;
  let service: DocumentationService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentationController],
      providers: [
        {
          provide: DocumentationService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(StaffOrAdminAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<DocumentationController>(DocumentationController);
    service = module.get<DocumentationService>(DocumentationService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create documentation with valid dto and files', async () => {
      const dto: CreateDocumentationDto = { name: 'API Docs' };
      const req = { staffId: '1' };
      const files = [{ location: 's3-url-1' }] as any;

      mockService.create.mockResolvedValue({ id: 'uuid-1', ...dto, files: ['s3-url-1'] });

      const result = await controller.create(files, JSON.stringify(dto), req);

      expect(result).toHaveProperty('id', 'uuid-1');
      expect(mockService.create).toHaveBeenCalledWith(dto, '1', ['s3-url-1']);
    });

    it('should fallback to userId from req if staffId is absent', async () => {
      const dto: CreateDocumentationDto = { name: 'Admin Docs' };
      const req = { userId: '2' };
      
      await controller.create([], JSON.stringify(dto), req);

      expect(mockService.create).toHaveBeenCalledWith(dto, '2', []);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const expected = { data: [], total: 0, page: 1, limit: 10 };
      mockService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll('1', '10', 'search');

      expect(result).toEqual(expected);
      expect(mockService.findAll).toHaveBeenCalledWith(1, 10, 'search');
    });
  });

  describe('findOne', () => {
    it('should return a single documentation by UUID', async () => {
      const mockDoc = { id: 'uuid-1', name: 'Doc' };
      mockService.findOne.mockResolvedValue(mockDoc);

      const result = await controller.findOne('uuid-1');

      expect(result).toEqual(mockDoc);
      expect(mockService.findOne).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('update', () => {
    it('should update documentation with UUID', async () => {
      const req = { staffId: '1' };
      const files = [{ location: 'new-url' }] as any;
      mockService.update.mockResolvedValue({ id: 'uuid-1', name: 'Updated' });

      const result = await controller.update('uuid-1', files, JSON.stringify({ name: 'Updated' }), req);

      expect(result).toHaveProperty('name', 'Updated');
      expect(mockService.update).toHaveBeenCalledWith('uuid-1', { name: 'Updated' }, '1', ['new-url']);
    });
  });

  describe('remove', () => {
    it('should remove documentation by UUID', async () => {
      const req = { staffId: '1' };
      mockService.remove.mockResolvedValue({ message: 'Deleted' });

      const result = await controller.remove('uuid-1', req);

      expect(result).toEqual({ message: 'Deleted' });
      expect(mockService.remove).toHaveBeenCalledWith('uuid-1', '1');
    });
  });
});
