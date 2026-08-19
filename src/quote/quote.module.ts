import { Module } from '@nestjs/common';
import { QuoteService } from './quote.service';
import { QuoteController } from './quote.controller';
import { Quote } from './entities/quote.entity';
import { Admin } from 'src/admin/entities/admin.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Staff } from 'src/staff-register/entities/staff-register.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Quote, Admin, Staff])],
  controllers: [QuoteController],
  providers: [QuoteService],
})
export class QuoteModule {}
