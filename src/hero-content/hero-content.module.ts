import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeroContent } from './entities/hero-content.entity';
import { HeroContentService } from './hero-content.service';
import { HeroContentController } from './hero-content.controller';
import { MemberActivityModule } from '../member-activity/member-activity.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HeroContent]),
    MemberActivityModule,
    AdminModule,
  ],
  controllers: [HeroContentController],
  providers: [HeroContentService],
  exports: [HeroContentService],
})
export class HeroContentModule {}
