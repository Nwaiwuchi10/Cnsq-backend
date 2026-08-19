import { Test, TestingModule } from '@nestjs/testing';
import { HeroContentController } from './hero-content.controller';
import { HeroContentService } from './hero-content.service';
import { UserAuthGuard } from '../admin/guard/auth.guard';
import { CanActivate } from '@nestjs/common';

const mockHeroContentService = () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

const mockGuard: CanActivate = {
  canActivate: jest.fn(() => true),
};

describe('HeroContentController', () => {
  let controller: HeroContentController;
  let service: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HeroContentController],
      providers: [
        {
          provide: HeroContentService,
          useFactory: mockHeroContentService,
        },
      ],
    })
      .overrideGuard(UserAuthGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<HeroContentController>(HeroContentController);
    service = module.get<HeroContentService>(HeroContentService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create hero content with image', async () => {
      const dto = {
        title: 'Test',
        description: 'Desc',
        tag: 'Tag',
        link: 'https://test.com',
      };
      const mockFile: any = {
        location: 'https://s3.amazonaws.com/bucket/image.png',
      };

      service.create.mockResolvedValue({ id: 'uuid-1', ...dto, imageUrl: mockFile.location });

      const result = await controller.create(dto as any, mockFile);
      expect(service.create).toHaveBeenCalled();
      expect(result.imageUrl).toEqual(mockFile.location);
    });
  });

  describe('findAll', () => {
    it('should return all hero content', async () => {
      const contents = [{ id: 'uuid-1', title: 'Test' }];
      service.findAll.mockResolvedValue(contents);

      const result = await controller.findAll();
      expect(result).toEqual(contents);
    });
  });

  describe('findOne', () => {
    it('should return a single hero content', async () => {
      const content = { id: 'uuid-1', title: 'Test' };
      service.findOne.mockResolvedValue(content);

      const result = await controller.findOne('uuid-1');
      expect(result).toEqual(content);
    });
  });

  describe('update', () => {
    it('should update hero content', async () => {
      const dto = { title: 'New' };
      service.update.mockResolvedValue({ id: 'uuid-1', ...dto });

      const result = await controller.update('uuid-1', dto as any, undefined as any);
      expect(service.update).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove hero content', async () => {
      service.remove.mockResolvedValue(undefined);
      await controller.remove('uuid-1');
      expect(service.remove).toHaveBeenCalledWith('uuid-1');
    });
  });
});
