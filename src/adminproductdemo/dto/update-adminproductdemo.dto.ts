import { PartialType } from '@nestjs/mapped-types';
import { CreateAdminproductdemoDto } from './create-adminproductdemo.dto';

export class UpdateAdminproductdemoDto extends PartialType(CreateAdminproductdemoDto) {}
