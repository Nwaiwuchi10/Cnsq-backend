import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerError } from './entities/server-error.entity';
import { ServerErrorService } from './server-error.service';
import { ServerErrorController } from './server-error.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ServerError])],
  providers: [ServerErrorService],
  controllers: [ServerErrorController],
  exports: [ServerErrorService],
})
export class ServerErrorModule {}
