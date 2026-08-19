// src/staff/dto/staff-anniversary.dto.ts
import { Staff } from '../entities/staff-register.entity';

export class StaffAnniversaryDto extends Staff {
  nextAnniversary: Date;
  yearsCompleted: number;
}
export class StaffRecentAnniversaryDto extends Staff {
  lastAnniversary: Date;
  // yearsCompleted: number;
}
