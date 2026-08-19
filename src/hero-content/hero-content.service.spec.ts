import { Test, TestingModule } from '@nestjs/testing';
import { HeroContentService } from './hero-content.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HeroContent } from './entities/hero-content.entity';
import { NotFoundException } from '@nestjs/common';

const mockHeroContentRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

describe('HeroContentService', () => {
  let service: HeroContentService;
  let repository: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HeroContentService,
        {
          provide: getRepositoryToken(HeroContent),
          useFactory: mockHeroContentRepository,
        },
      ],
    }).compile();

    service = module.get<HeroContentService>(HeroContentService);
    repository = module.get(getRepositoryToken(HeroContent));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a new hero content', async () => {
      const dto = {
        title: 'Test Title',
        description: 'Test Desc',
        tag: 'Test Tag',
        link: 'https://test.com',
        imageUrl: 'http://test.com/image.png',
      };
      repository.create.mockReturnValue(dto);
      repository.save.mockResolvedValue({ id: 'uuid-1', ...dto });

      const result = await service.create(dto);
      expect(result).toEqual({ id: 'uuid-1', ...dto });
      expect(repository.save).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should return all hero content', async () => {
      const contents = [{ id: 'uuid-1', title: 'Content 1' }];
      repository.find.mockResolvedValue(contents);

      const result = await service.findAll();
      expect(result).toEqual(contents);
    });
  });

  describe('findOne', () => {
    it('should return a single hero content', async () => {
      const content = { id: 'uuid-1', title: 'Content 1' };
      repository.findOne.mockResolvedValue(content);

      const result = await service.findOne('uuid-1');
      expect(result).toEqual(content);
    });

    it('should throw NotFoundException if content not found', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.findOne('uuid-99')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update hero content', async () => {
      const content = { id: 'uuid-1', title: 'Old Title' };
      const dto = { title: 'New Title' };
      repository.findOne.mockResolvedValue(content);
      repository.save.mockResolvedValue({ ...content, ...dto });

      const result = await service.update('uuid-1', dto);
      expect(result.title).toEqual('New Title');
    });
  });

  describe('remove', () => {
    it('should remove hero content', async () => {
      const content = { id: 'uuid-1', title: 'Content 1' };
      repository.findOne.mockResolvedValue(content);
      repository.remove.mockResolvedValue(content);

      await service.remove('uuid-1');
      expect(repository.remove).toHaveBeenCalledWith(content);
    });
  });
});
