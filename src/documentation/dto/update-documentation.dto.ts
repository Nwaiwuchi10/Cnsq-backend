import { PartialType } from '@nestjs/mapped-types';
import { CreateDocumentationDto } from './create-documentation.dto';

export class UpdateDocumentationDto extends PartialType(CreateDocumentationDto) {}
