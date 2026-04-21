import {
  IsString,
  IsOptional,
  IsNumber,
  IsIn,
  IsInt,
  IsDateString,
  Min,
  MaxLength,
  IsPositive,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * CreateCouponDto — validated payload for creating a coupon.
 *
 * Applied by the global ValidationPipe in main.ts.
 * discount_type accepts 'percent', 'percentage', and 'fixed' for
 * backward compatibility with legacy forms that post 'percentage'.
 */
export class CreateCouponDto {
  @IsString()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsIn(['percent', 'percentage', 'fixed'])
  discount_type: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discount_value: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  min_purchase?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  max_discount?: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  usage_limit?: number;

  /**
   * 1 = active, 0 = inactive.
   * Accepts boolean-like values; transformer coerces to number.
   */
  @IsOptional()
  @Type(() => Number)
  is_active?: number;

  /**
   * 'global' | 'artisan'
   * Global coupons apply to any item; artisan-scoped coupons only apply
   * to items sold by the artisan with artisan_id.
   */
  @IsString()
  @IsOptional()
  @IsIn(['global', 'artisan'])
  scope?: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  artisan_id?: number;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  created_by?: number;

  @IsDateString()
  @IsOptional()
  valid_from?: string;

  @IsDateString()
  @IsOptional()
  valid_until?: string;
}
