import {
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  IsDateString,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * CreateAuctionDto
 *
 * Validates the incoming form/body payload when creating a new auction.
 *
 * Rules that mirror the original Express validation logic:
 *   - title is required ONLY when no product_id is provided (enforced at the
 *     service layer after basic validation passes here).
 *   - starting_price must be a positive number.
 *   - end_time must be a valid ISO date string and must be after start_time
 *     (checked in the service).
 *   - bid_increment, reserve_price, starting_bid are all optional.
 */
export class CreateAuctionDto {
  // ------------------------------------------------------------------
  // Product linkage (optional — standalone auctions have no product)
  // ------------------------------------------------------------------

  @IsOptional()
  @IsInt({ message: 'product_id must be an integer' })
  @IsPositive({ message: 'product_id must be a positive integer' })
  @Type(() => Number)
  product_id?: number;

  // ------------------------------------------------------------------
  // Core fields
  // ------------------------------------------------------------------

  /**
   * Human-readable title.
   * Required when no product_id is provided (enforced in service).
   */
  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(255, { message: 'Title must be at most 255 characters' })
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Description must be at most 2000 characters' })
  description?: string;

  /**
   * JSON-stringified array of image paths uploaded by the artisan for
   * standalone auctions.  Stored as-is in the DB column.
   */
  @IsOptional()
  @IsString()
  images?: string;

  // ------------------------------------------------------------------
  // Pricing
  // ------------------------------------------------------------------

  @IsNumber({}, { message: 'Starting price must be a number' })
  @IsPositive({ message: 'Starting price must be positive' })
  @Max(1_000_000, { message: 'Starting price cannot exceed $1,000,000' })
  @Type(() => Number)
  starting_price: number;

  /**
   * Alias accepted from older form fields; service normalises to starting_price.
   */
  @IsOptional()
  @IsNumber({}, { message: 'starting_bid must be a number' })
  @IsPositive({ message: 'starting_bid must be positive' })
  @Type(() => Number)
  starting_bid?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Reserve price must be a number' })
  @Min(0, { message: 'Reserve price must be non-negative' })
  @Type(() => Number)
  reserve_price?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Bid increment must be a number' })
  @IsPositive({ message: 'Bid increment must be positive' })
  @Type(() => Number)
  bid_increment?: number;

  // ------------------------------------------------------------------
  // Schedule
  // ------------------------------------------------------------------

  @IsDateString({}, { message: 'start_time must be a valid ISO date string' })
  start_time: string;

  @IsDateString({}, { message: 'end_time must be a valid ISO date string' })
  end_time: string;
}
