import { IsOptional, IsString, MinLength } from 'class-validator';
import { RegisterDto } from './register.dto';

/**
 * ArtisanRegisterDto — extends the base customer registration with artisan-
 * specific fields required when onboarding as a maker.
 *
 * All base fields (name, email, password, phone?) are inherited from RegisterDto.
 */
export class ArtisanRegisterDto extends RegisterDto {
  /**
   * Public shop name shown on the artisan's storefront.
   * Required — the artisan profile cannot be created without it.
   */
  @IsString()
  @MinLength(2, { message: 'Shop name must be at least 2 characters' })
  shop_name: string;

  /**
   * Short bio shown on the artisan's profile page.
   * Optional — can be updated later from the artisan dashboard.
   */
  @IsOptional()
  @IsString()
  bio?: string;
}
