// src/staff/dto/staff-birthday.dto.ts

import { Staff } from '../entities/staff-register.entity';

export class StaffBirthdayDto extends Staff {
  nextBirthday: Date;
}
