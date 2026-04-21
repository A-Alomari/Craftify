import {
  IsString,
  IsOptional,
  IsIn,
  IsUUID,
  MaxLength,
  MinLength,
  IsNumberString,
  ValidateIf,
  Matches,
} from 'class-validator';

/**
 * CheckoutDto — validated body for POST /orders/checkout.
 *
 * Card fields are conditionally required: only validated when
 * payment_method === 'card'.
 *
 * The checkoutNonce is a UUID v4 generated server-side and embedded in
 * the checkout form; it provides idempotency so double-submissions do
 * not create duplicate orders.
 */
export class CheckoutDto {
  @IsUUID('4')
  checkoutNonce: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  shipping_address: string;

  /**
   * Apartment / Suite / Building — optional secondary address line.
   */
  @IsString()
  @IsOptional()
  @MaxLength(100)
  building?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  postal_code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  country: string;

  @IsIn(['card', 'cash'])
  payment_method: 'card' | 'cash';

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;

  // -------------------------------------------------------------------------
  // Card fields — required when payment_method === 'card'
  // -------------------------------------------------------------------------

  @ValidateIf((o: CheckoutDto) => o.payment_method === 'card')
  @IsString()
  @MinLength(13)
  @MaxLength(19)
  @IsNumberString()
  card_number?: string;

  @ValidateIf((o: CheckoutDto) => o.payment_method === 'card')
  @IsString()
  @Matches(/^(0[1-9]|1[0-2])\/\d{2,4}$/, {
    message: 'card_expiry must be in MM/YY or MM/YYYY format',
  })
  card_expiry?: string;

  @ValidateIf((o: CheckoutDto) => o.payment_method === 'card')
  @IsString()
  @MinLength(3)
  @MaxLength(4)
  @IsNumberString()
  card_cvv?: string;
}
