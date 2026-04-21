import { PartialType } from '@nestjs/mapped-types';
import { CreateCouponDto } from './create-coupon.dto';

/**
 * UpdateCouponDto — all fields optional for PATCH semantics.
 * Inherits all validators from CreateCouponDto via PartialType.
 */
export class UpdateCouponDto extends PartialType(CreateCouponDto) {}
