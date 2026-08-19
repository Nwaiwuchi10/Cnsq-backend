import { Controller, Get, UseGuards } from '@nestjs/common';
import { ServerErrorService } from './server-error.service';
import { UserAuthGuard } from 'src/admin/guard/auth.guard';

@Controller('server-error')
export class ServerErrorController {
  constructor(private readonly errorService: ServerErrorService) {}

  @Get()
  @UseGuards(UserAuthGuard)
  async getErrors() {
    return await this.errorService.findAll();
  }
}
