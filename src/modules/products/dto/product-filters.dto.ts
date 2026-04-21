import {
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsIn,
  Min,
  IsInt,
  IsPositive,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * ProductFiltersDto
 *
 * Parsed and validated from GET /products query parameters.
 *
 * All fields are optional — the controller applies sensible defaults when
 * a field is absent (e.g. page defaults to 1, sort defaults to 'newest').
 *
 * `category` accepts a single numeric string or an array of numeric strings
 * from repeated query params (?category=1&category=3). The @Transform
 * decorator normalises both forms to number[].
 */
export class ProductFiltersDto {
  // ---------------------------------------------------------------------------
  // Category — single or multi-select (checkbox array)
  // ---------------------------------------------------------------------------

  /**
   * One or more category IDs.
   * Query can be ?category=1 (single) or ?category=1&category=3 (multiple).
   * Always normalised to number[] for internal use.
   */
  @IsOptional()
  @Transform(({ value }): number[] => {
    if (value === undefined || value === null || value === '') return [];
    const raw = Array.isArray(value) ? value : [value];
    return raw
      .map((v: unknown) => parseInt(String(v), 10))
      .filter((n: number) => !isNaN(n) && n > 0);
  })
  category?: number[];

  // ---------------------------------------------------------------------------
  // Text search
  // ---------------------------------------------------------------------------

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : undefined))
  search?: string;

  // ---------------------------------------------------------------------------
  // Sort order
  // ---------------------------------------------------------------------------

  @IsOptional()
  @IsString()
  @IsIn(
    [
      'newest',
      'oldest',
      'price_low',
      'price_high',
      'price_asc',
      'price_desc',
      'popular',
      'rating',
      'highest_rated',
    ],
    { message: 'Invalid sort option' },
  )
  sort?: string;

  // ---------------------------------------------------------------------------
  // Price range
  // ---------------------------------------------------------------------------

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  min_price?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  max_price?: number;

  // ---------------------------------------------------------------------------
  // Featured flag
  // ---------------------------------------------------------------------------

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1' || value === true) return true;
    if (value === 'false' || value === '0' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  featured?: boolean;

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  limit?: number;

  // ---------------------------------------------------------------------------
  // Status filter (used by admin routes — defaults to 'approved' in public routes)
  // ---------------------------------------------------------------------------

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'approved', 'rejected', 'all'])
  status?: string;

  // ---------------------------------------------------------------------------
  // Artisan filter (for artisan-scoped product browsing)
  // ---------------------------------------------------------------------------

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  artisan_id?: number;
}
