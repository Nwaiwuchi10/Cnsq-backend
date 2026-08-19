import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HeroContent } from './entities/hero-content.entity';
import { CreateHeroContentDto } from './dto/create-hero-content.dto';
import { UpdateHeroContentDto } from './dto/update-hero-content.dto';

@Injectable()
export class HeroContentService {
  constructor(
    @InjectRepository(HeroContent)
    private readonly heroContentRepo: Repository<HeroContent>,
  ) {}

  async create(createHeroContentDto: CreateHeroContentDto): Promise<HeroContent> {
    const heroContent = this.heroContentRepo.create(createHeroContentDto);
    return await this.heroContentRepo.save(heroContent);
  }

  async findAll(): Promise<HeroContent[]> {
    return await this.heroContentRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<HeroContent> {
    const heroContent = await this.heroContentRepo.findOne({ where: { id } });
    if (!heroContent) {
      throw new NotFoundException(`Hero content with ID ${id} not found`);
    }
    return heroContent;
  }

  async update(
    id: string,
    updateHeroContentDto: UpdateHeroContentDto,
  ): Promise<HeroContent> {
    const heroContent = await this.findOne(id);
    Object.assign(heroContent, updateHeroContentDto);
    return await this.heroContentRepo.save(heroContent);
  }

  async remove(id: string): Promise<void> {
    const heroContent = await this.findOne(id);
    await this.heroContentRepo.remove(heroContent);
  }
}
