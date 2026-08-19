import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BirthdayService } from './birthday.service';
import { CreateBirthdayDto } from './dto/create-birthday.dto';
import { UpdateBirthdayDto } from './dto/update-birthday.dto';

@Controller('birthday')
export class BirthdayController {
  constructor(private readonly birthdayService: BirthdayService) {}

  @Post()
  create(@Body() createBirthdayDto: CreateBirthdayDto) {
    return this.birthdayService.create(createBirthdayDto);
  }

  @Get()
  findAll() {
    return this.birthdayService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.birthdayService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBirthdayDto: UpdateBirthdayDto) {
    return this.birthdayService.update(+id, updateBirthdayDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.birthdayService.remove(+id);
  }
}
