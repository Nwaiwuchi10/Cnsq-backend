import { Test, TestingModule } from '@nestjs/testing';
import { BirthdayService } from './birthday.service';
import { getRepositoryToken } from '@nestjs/typeorm';

const mockRepository = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(),
});

describe('BirthdayService', () => {
  let service: BirthdayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BirthdayService],
    }).compile();

    service = module.get<BirthdayService>(BirthdayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a birthday entry', () => {
      const createBirthdayDto = { name: 'Test Birthday' };
      const result = service.create(createBirthdayDto);
      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should return all birthdays', () => {
      const result = service.findAll();
      expect(result).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('should return a single birthday', () => {
      const result = service.findOne(1);
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update a birthday', () => {
      const updateBirthdayDto = { name: 'Updated Birthday' };
      const result = service.update(1, updateBirthdayDto);
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should remove a birthday', () => {
      const result = service.remove(1);
      expect(result).toBeDefined();
    });
  });
});
