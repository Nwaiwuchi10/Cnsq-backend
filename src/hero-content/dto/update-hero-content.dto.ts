import { PartialType } from '@nestjs/mapped-types';
import { CreateHeroContentDto } from './create-hero-content.dto';

export class UpdateHeroContentDto extends PartialType(CreateHeroContentDto) {}
