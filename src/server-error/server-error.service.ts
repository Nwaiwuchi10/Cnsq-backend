import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServerError } from './entities/server-error.entity';

@Injectable()
export class ServerErrorService {
  constructor(
    @InjectRepository(ServerError)
    private readonly errorRepo: Repository<ServerError>,
  ) {}

  async create(errorData: Partial<ServerError>) {
    try {
      const error = this.errorRepo.create(errorData);
      return await this.errorRepo.save(error);
    } catch (dbError) {
      // If we can't save the error log to the DB, just print to console
      // to avoid infinite recursion or secondary crashes
      console.error('Critical: Failed to save ErrorLog to Database', dbError);
    }
  }

  async findAll() {
    return await this.errorRepo.find({
      order: { timestamp: 'DESC' },
      take: 50, // Get last 50 errors
    });
  }
}
