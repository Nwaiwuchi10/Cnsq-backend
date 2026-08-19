// src/admin-product-demo/dto/get-admin-product-demos.dto.ts
import { IsOptional, IsNumberString, IsString } from 'class-validator';

export class GetAdminProductDemosDto {
  @IsOptional()
  @IsNumberString()
  page?: number;

  @IsOptional()
  @IsNumberString()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;
}
