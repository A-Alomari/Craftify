import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsInt,
  IsPositive,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * CreateCategoryDto
 *
 * Validated payload for POST /admin/categories (category creation).
 * Used by AdminModule's category management endpoints.
 *
 * `slug` is optional — the CategoriesService will auto-generate it from
 * `name` when omitted (lowercase, spaces → hyphens, non-alnum stripped).
 */
export class CreateCategoryDto {
  // ---------------------------------------------------------------------------
  // Required fields
  // ---------------------------------------------------------------------------

  @IsString({ message: 'Category name must be a string' })
  @MinLength(2, { message: 'Category name must be at least 2 characters' })
  @MaxLength(100, { message: 'Category name must be at most 100 characters' })
  name: string;

  // ---------------------------------------------------------------------------
  // Optional fields
  // ---------------------------------------------------------------------------

  /**
   * URL-safe slug.  Auto-generated from `name` when not provided.
   * Must contain only lowercase letters, digits, and hyphens.
   */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase letters, digits, and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must be at most 500 characters' })
  description?: string;

  /**
   * URL of the category's representative image.
   */
  @IsOptional()
  @IsString()
  image?: string;

  /**
   * Parent category ID for nested (hierarchical) categories.
   * Null / absent means root-level category.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'parent_id must be an integer' })
  @IsPositive({ message: 'parent_id must be a positive integer' })
  parent_id?: number;

  /**
   * Whether the category is visible in the storefront.
   * Defaults to true (active) when not provided.
   */
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  is_active?: boolean;
}
