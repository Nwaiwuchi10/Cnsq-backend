import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateAdminproductdemoDto {
  @IsNotEmpty()
  nameOfProduct: string;

  @IsString()
  description: string;

  @IsString()
  howItWorks: string;

  @IsArray()
  @IsOptional()
  videos?: string[];

  @IsNotEmpty()
  createdById: number; // Admin ID
}
