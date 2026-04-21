import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Coupon } from '../../database/entities/coupon.entity';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  discount: number;
  coupon?: Coupon;
  error?: string;
}

export interface CouponStats {
  total: number;
  active: number;
  expired: number;
  global: number;
  artisan_scoped: number;
}

export interface FindAllFilters {
  active?: boolean;
  scope?: string;
  artisan_id?: number;
  created_by?: number;
}

// ---------------------------------------------------------------------------
// CouponsService
// ---------------------------------------------------------------------------

/**
 * CouponsService
 *
 * Centralises all coupon-related business logic:
 *   - CRUD (findById, findByCode, findAll, create, update, delete, toggleActive)
 *   - Validation and discount calculation (validate)
 *   - Usage tracking (use)
 *   - Stats aggregation (getStats)
 *
 * BUG FIXES applied vs legacy Coupon.js model:
 *   1. valid_from check uses `valid_from` directly (not `valid_from || valid_until`)
 *   2. discount_type comparison accepts both 'percent' AND 'percentage'
 *   3. Date comparisons use UTC milliseconds to avoid TZ-offset false failures
 */
@Injectable()
export class CouponsService {
  constructor(
    @InjectRepository(Coupon)
    private readonly couponRepository: Repository<Coupon>,
  ) {}

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  async findById(id: number): Promise<Coupon | null> {
    return this.couponRepository.findOne({ where: { id } });
  }

  async findByCode(code: string): Promise<Coupon | null> {
    return this.couponRepository.findOne({
      where: { code: code.toUpperCase().trim() },
    });
  }

  async findAll(filters: FindAllFilters = {}): Promise<Coupon[]> {
    const qb = this.couponRepository
      .createQueryBuilder('c')
      .orderBy('c.created_at', 'DESC');

    if (filters.active !== undefined) {
      qb.andWhere('c.is_active = :active', { active: filters.active ? 1 : 0 });
    }

    if (filters.scope !== undefined) {
      qb.andWhere('c.scope = :scope', { scope: filters.scope });
    }

    if (filters.artisan_id !== undefined) {
      qb.andWhere('c.artisan_id = :artisanId', {
        artisanId: filters.artisan_id,
      });
    }

    if (filters.created_by !== undefined) {
      qb.andWhere('c.created_by = :createdBy', {
        createdBy: filters.created_by,
      });
    }

    return qb.getMany();
  }

  // -------------------------------------------------------------------------
  // Writes
  // -------------------------------------------------------------------------

  async create(data: CreateCouponDto & { created_by?: number }): Promise<Coupon> {
    const normalizedCode = data.code.toUpperCase().trim();

    // Ensure code uniqueness
    const existing = await this.couponRepository.findOne({
      where: { code: normalizedCode },
    });
    if (existing) {
      throw new BadRequestException(`Coupon code '${normalizedCode}' already exists`);
    }

    // Validate that expiry is not in the past
    if (data.valid_until) {
      const expiryDate = new Date(data.valid_until);
      if (expiryDate.getTime() < Date.now()) {
        throw new BadRequestException('Expiry date cannot be in the past');
      }
    }

    const coupon = this.couponRepository.create({
      code: normalizedCode,
      description: data.description ?? null,
      discount_type: data.discount_type,
      discount_value: data.discount_value,
      min_purchase: data.min_purchase ?? 0,
      max_discount: data.max_discount ?? null,
      usage_limit: data.usage_limit ?? null,
      times_used: 0,
      is_active: data.is_active !== undefined ? Number(data.is_active) : 1,
      scope: data.scope ?? 'global',
      artisan_id: data.artisan_id ?? null,
      created_by: data.created_by ?? null,
      valid_from: data.valid_from ? new Date(data.valid_from) : null,
      valid_until: data.valid_until ? new Date(data.valid_until) : null,
    });

    return this.couponRepository.save(coupon);
  }

  async update(id: number, data: UpdateCouponDto): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon #${id} not found`);
    }

    if (data.code !== undefined) {
      coupon.code = data.code.toUpperCase().trim();
    }
    if (data.description !== undefined) coupon.description = data.description;
    if (data.discount_type !== undefined) coupon.discount_type = data.discount_type;
    if (data.discount_value !== undefined) coupon.discount_value = data.discount_value;
    if (data.min_purchase !== undefined) coupon.min_purchase = data.min_purchase;
    if (data.max_discount !== undefined) coupon.max_discount = data.max_discount;
    if (data.usage_limit !== undefined) coupon.usage_limit = data.usage_limit;
    if (data.is_active !== undefined) coupon.is_active = Number(data.is_active);
    if (data.scope !== undefined) coupon.scope = data.scope;
    if (data.artisan_id !== undefined) coupon.artisan_id = data.artisan_id;
    if (data.valid_from !== undefined) {
      coupon.valid_from = data.valid_from ? new Date(data.valid_from) : null;
    }
    if (data.valid_until !== undefined) {
      coupon.valid_until = data.valid_until ? new Date(data.valid_until) : null;
    }

    return this.couponRepository.save(coupon);
  }

  async delete(id: number): Promise<void> {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon #${id} not found`);
    }
    await this.couponRepository.remove(coupon);
  }

  async toggleActive(id: number): Promise<Coupon> {
    const coupon = await this.couponRepository.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon #${id} not found`);
    }
    coupon.is_active = coupon.is_active === 1 ? 0 : 1;
    return this.couponRepository.save(coupon);
  }

  // -------------------------------------------------------------------------
  // Validation & discount calculation
  // -------------------------------------------------------------------------

  /**
   * validate — determines whether a coupon code is applicable for the
   * given order total and item set, and calculates the discount amount.
   *
   * BUG FIXES vs legacy model:
   *   - valid_from is checked independently (not ORed with valid_until)
   *   - discount_type 'percentage' is treated the same as 'percent'
   *   - All date comparisons use UTC epoch ms to avoid localtime skew
   *
   * @param code        Coupon code to validate (case-insensitive)
   * @param orderTotal  Subtotal of the order (before shipping/discount)
   * @param items       Order/cart items (used for artisan-scope checks)
   */
  async validate(
    code: string,
    orderTotal: number,
    items: Array<{ artisan_id?: number | null; product?: { artisan_id?: number } }> = [],
  ): Promise<ValidationResult> {
    const coupon = await this.findByCode(code);

    if (!coupon) {
      return { valid: false, discount: 0, error: 'Invalid coupon code' };
    }

    if (coupon.is_active !== 1) {
      return { valid: false, discount: 0, error: 'This coupon is no longer active' };
    }

    // Date validation — UTC epoch comparison avoids timezone offset bugs
    const nowMs = Date.now();

    // BUG FIX: was `valid_from || valid_until`, now uses valid_from directly
    if (coupon.valid_from !== null && coupon.valid_from !== undefined) {
      const validFromMs = new Date(coupon.valid_from).getTime();
      if (nowMs < validFromMs) {
        return { valid: false, discount: 0, error: 'This coupon is not yet active' };
      }
    }

    if (coupon.valid_until !== null && coupon.valid_until !== undefined) {
      const validUntilMs = new Date(coupon.valid_until).getTime();
      if (nowMs > validUntilMs) {
        return { valid: false, discount: 0, error: 'This coupon has expired' };
      }
    }

    // Usage limit
    if (
      coupon.usage_limit !== null &&
      coupon.usage_limit !== undefined &&
      coupon.times_used >= coupon.usage_limit
    ) {
      return { valid: false, discount: 0, error: 'This coupon has reached its usage limit' };
    }

    // Minimum purchase
    if (coupon.min_purchase > 0 && orderTotal < coupon.min_purchase) {
      return {
        valid: false,
        discount: 0,
        error: `Minimum purchase of $${coupon.min_purchase.toFixed(2)} required for this coupon`,
      };
    }

    // Artisan scope — coupon only applies to items from the scoped artisan
    if (coupon.scope === 'artisan' && coupon.artisan_id !== null) {
      const hasArtisanItem = items.some(
        (item) =>
          item.artisan_id === coupon.artisan_id ||
          item.product?.artisan_id === coupon.artisan_id,
      );
      if (!hasArtisanItem) {
        return {
          valid: false,
          discount: 0,
          error: 'This coupon is not valid for the items in your cart',
        };
      }
    }

    // Calculate discount
    // BUG FIX: treat 'percentage' same as 'percent'
    const discountType = coupon.discount_type;
    let discount = 0;

    if (discountType === 'percent' || discountType === 'percentage') {
      discount = orderTotal * (coupon.discount_value / 100);
      if (coupon.max_discount !== null && coupon.max_discount !== undefined) {
        discount = Math.min(discount, coupon.max_discount);
      }
    } else if (discountType === 'fixed') {
      discount = Math.min(coupon.discount_value, orderTotal);
    }

    // Round to 2 decimal places to avoid floating-point drift
    discount = Math.round(discount * 100) / 100;

    return { valid: true, discount, coupon };
  }

  /**
   * use — increments times_used atomically.
   * Called after a successful order is created.
   */
  async use(code: string): Promise<void> {
    await this.couponRepository
      .createQueryBuilder()
      .update(Coupon)
      .set({ times_used: () => 'times_used + 1' })
      .where('UPPER(code) = UPPER(:code)', { code })
      .execute();
  }

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  async getStats(): Promise<CouponStats> {
    const now = new Date().toISOString();

    const [total, active, expired, global, artisan_scoped] = await Promise.all([
      this.couponRepository.count(),

      this.couponRepository
        .createQueryBuilder('c')
        .where('c.is_active = 1')
        .getCount(),

      // Expired = has valid_until AND valid_until < now
      this.couponRepository
        .createQueryBuilder('c')
        .where('c.valid_until IS NOT NULL AND c.valid_until < :now', { now })
        .getCount(),

      this.couponRepository
        .createQueryBuilder('c')
        .where('c.scope = :scope', { scope: 'global' })
        .getCount(),

      this.couponRepository
        .createQueryBuilder('c')
        .where('c.scope = :scope', { scope: 'artisan' })
        .getCount(),
    ]);

    return { total, active, expired, global, artisan_scoped };
  }
}
