import { Injectable } from '@nestjs/common';
import { CreateBirthdayDto } from './dto/create-birthday.dto';
import { UpdateBirthdayDto } from './dto/update-birthday.dto';

@Injectable()
export class BirthdayService {
  create(createBirthdayDto: CreateBirthdayDto) {
    return 'This action adds a new birthday';
  }

  findAll() {
    return `This action returns all birthday`;
  }

  findOne(id: number) {
    return `This action returns a #${id} birthday`;
  }

  update(id: number, updateBirthdayDto: UpdateBirthdayDto) {
    return `This action updates a #${id} birthday`;
  }

  remove(id: number) {
    return `This action removes a #${id} birthday`;
  }
}
