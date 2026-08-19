import { IsArray, IsInt, IsString, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

class SingleAssignmentDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  staffId: number;

  @IsString()
  role: string;
}

export class AssignStaffDto {
  // @IsInt()
  // projectId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SingleAssignmentDto)
  assignments: SingleAssignmentDto[];
}
//

// import { Type } from 'class-transformer';
// import {
//   ValidateNested,
//   IsArray,
//   IsInt,
//   IsString,
//   MinLength,
// } from 'class-validator';

// export class StaffAssignmentDto {
//   @IsInt({ message: 'Staff ID must be an integer' })
//   staffId: number;

//   @IsString({ message: 'Role must be a string' })
//   @MinLength(2, { message: 'Role must be at least 2 characters long' })
//   role: string;
// }

// export class AssignStaffDto {
//   @IsInt()
//   projectId: number;

//   @IsArray()
//   @ValidateNested({ each: true })
//   @Type(() => StaffAssignmentDto)
//   assignments: StaffAssignmentDto[];
// }
