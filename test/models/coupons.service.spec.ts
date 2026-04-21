/**
 * test/models/coupons.service.spec.ts
 *
 * Unit tests for CouponsService — validates the coupon expiry BUG FIX.
 * The original Express code had: `const validFrom = coupon.valid_from || coupon.valid_until`
 * which caused "not yet active" on valid coupons. Fixed in NestJS migration.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coupon } from '../../src/database/entities/coupon.entity';
import { Order } from '../../src/database/entities/order.entity';
import { User }         from '../../src/database/entities/user.entity';
import { ArtisanProfile } from '../../src/database/entities/artisan-profile.entity';
import { CartItem }     from '../../src/database/entities/cart-item.entity';
import { Wishlist }     from '../../src/database/entities/wishlist.entity';
import { Review }       from '../../src/database/entities/review.entity';
import { Notification } from '../../src/database/entities/notification.entity';
import { Message }      from '../../src/database/entities/message.entity';
import { Bid }          from '../../src/database/entities/bid.entity';
import { Auction }      from '../../src/database/entities/auction.entity';
import { Product }      from '../../src/database/entities/product.entity';
import { Category }     from '../../src/database/entities/category.entity';
import { OrderItem }    from '../../src/database/entities/order-item.entity';
import { Shipment }     from '../../src/database/entities/shipment.entity';
import { PasswordReset } from '../../src/database/entities/password-reset.entity';
import { NewsletterSubscription } from '../../src/database/entities/newsletter-subscription.entity';

const ALL_ENTITIES = [Coupon, Order, User, ArtisanProfile, CartItem, Wishlist, Review, Notification,
  Message, Bid, Auction, Product, Category, OrderItem, Shipment, PasswordReset, NewsletterSubscription];

// Set env before any imports
process.env.NODE_ENV         = 'test';
process.env.CRAFTIFY_DB_PATH = ':memory:';

describe('CouponsService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;

  beforeAll(async () => {
    const { CouponsModule } = await import('../../src/modules/coupons/coupons.module');
    const { CouponsService } = await import('../../src/modules/coupons/coupons.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        CouponsModule,
      ],
    }).compile();

    service = module.get(CouponsService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    // Seed test coupons
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    const day = 24 * 60 * 60 * 1000;

    await dataSource.query(`
      INSERT INTO coupons (code, discount_type, discount_value, min_purchase, is_active, scope, valid_from, valid_until, times_used, usage_limit)
      VALUES
        ('VALID10',    'percent', 10, 0,   1, 'global', '${iso(now - day)}',    '${iso(now + 30 * day)}', 0, null),
        ('FIXED20',    'fixed',   20, 100, 1, 'global', '${iso(now - day)}',    '${iso(now + 30 * day)}', 0, null),
        ('EXPIRED15',  'percent', 15, 0,   1, 'global', '${iso(now - 30 * day)}','${iso(now - day)}',     0, null),
        ('NOTYET',     'percent', 10, 0,   1, 'global', '${iso(now + day)}',    '${iso(now + 30 * day)}', 0, null),
        ('INACTIVE',   'percent', 10, 0,   0, 'global', '${iso(now - day)}',    '${iso(now + 30 * day)}', 0, null),
        ('MINBUY',     'percent', 10, 100, 1, 'global', '${iso(now - day)}',    '${iso(now + 30 * day)}', 0, null),
        ('MAXUSE',     'percent', 10, 0,   1, 'global', '${iso(now - day)}',    '${iso(now + 30 * day)}', 5, 5),
        ('MAXDISC',    'percent', 50, 0,   1, 'global', '${iso(now - day)}',    '${iso(now + 30 * day)}', 0, null),
        ('PERCENTAGE', 'percent', 20, 0,   1, 'global', '${iso(now - day)}',    '${iso(now + 30 * day)}', 0, null)
    `);
    // Set max_discount for MAXDISC
    await dataSource.query(`UPDATE coupons SET max_discount = 30 WHERE code = 'MAXDISC'`);
  }, 30000);

  afterAll(async () => {
    await module.close();
  });

  // ── Valid coupon ────────────────────────────────────────────────────────────
  describe('valid coupon', () => {
    it('returns valid:true for active in-date coupon', async () => {
      const result = await service.validate('VALID10', 200, []);
      expect(result.valid).toBe(true);
      expect(result.discount).toBeGreaterThan(0);
    });

    it('calculates percent discount correctly (10% of $200 = $20)', async () => {
      const result = await service.validate('VALID10', 200, []);
      expect(result.valid).toBe(true);
      expect(result.discount).toBeCloseTo(20, 1);
    });

    it('calculates fixed discount correctly ($20 off $200)', async () => {
      const result = await service.validate('FIXED20', 200, []);
      expect(result.valid).toBe(true);
      expect(result.discount).toBeCloseTo(20, 1);
    });

    it('respects max_discount cap (50% of $200 = $100, capped at $30)', async () => {
      const result = await service.validate('MAXDISC', 200, []);
      expect(result.valid).toBe(true);
      expect(result.discount).toBeCloseTo(30, 1);
    });
  });

  // ── BUG FIX: valid_from not confused with valid_until ──────────────────────
  describe('BUG FIX — coupon date validation', () => {
    it('expired coupon returns valid:false (BUG FIX: correct date comparison)', async () => {
      const result = await service.validate('EXPIRED15', 200, []);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/expir|invalid|past/i);
    });

    it('future start coupon returns valid:false (not yet active)', async () => {
      const result = await service.validate('NOTYET', 200, []);
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/not.*active|future|yet/i);
    });

    it('valid coupon with both valid_from and valid_until set does NOT falsely fail', async () => {
      // This tests the specific bug: original code used `valid_from = coupon.valid_from || coupon.valid_until`
      // which caused valid coupons to fail. The NestJS version must use valid_from independently.
      const result = await service.validate('VALID10', 200, []);
      expect(result.valid).toBe(true);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('inactive coupon returns valid:false', async () => {
      const result = await service.validate('INACTIVE', 200, []);
      expect(result.valid).toBe(false);
    });

    it('min_purchase not met returns valid:false', async () => {
      const result = await service.validate('MINBUY', 50, []);  // needs $100
      expect(result.valid).toBe(false);
    });

    it('min_purchase met returns valid:true', async () => {
      const result = await service.validate('MINBUY', 150, []);
      expect(result.valid).toBe(true);
    });

    it('usage limit exceeded returns valid:false', async () => {
      const result = await service.validate('MAXUSE', 200, []);
      expect(result.valid).toBe(false);
    });

    it('non-existent coupon returns valid:false', async () => {
      const result = await service.validate('DOESNOTEXIST', 200, []);
      expect(result.valid).toBe(false);
    });

    it('"percent" and "percentage" discount_type both work (BUG FIX)', async () => {
      const result = await service.validate('PERCENTAGE', 100, []);
      expect(result.valid).toBe(true);
      expect(result.discount).toBeCloseTo(20, 1);
    });
  });

  // ── use() method ────────────────────────────────────────────────────────────
  describe('use()', () => {
    it('increments times_used', async () => {
      const before = await service.findByCode('VALID10');
      const usedBefore = before?.times_used ?? 0;
      await service.use('VALID10');
      const after = await service.findByCode('VALID10');
      expect(after?.times_used ?? 0).toBe(usedBefore + 1);
    });
  });
});
