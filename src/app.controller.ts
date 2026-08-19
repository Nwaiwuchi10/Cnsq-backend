import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { AppService } from './app.service';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async checkHealth() {
    try {
      // Check database connection
      if (!this.dataSource.isInitialized) {
        throw new Error('Database connection is not initialized');
      }
      await this.dataSource.query('SELECT 1');

      return {
        status: 'ok',
        message: 'CN Squad Backend is running smoothly',
        database: 'connected',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      };
    } catch (error: any) {
      throw new HttpException(
        {
          status: 'error',
          message: 'Backend is experiencing issues',
          database: 'disconnected',
          error: error.message,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
