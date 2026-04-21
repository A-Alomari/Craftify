import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';

/**
 * UpdateCategoryDto
 *
 * Validated payload for PATCH/PUT /admin/categories/:id.
 *
 * Extends CreateCategoryDto with all fields made optional via PartialType
 * so partial updates are supported (only provided fields are updated).
 */
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
