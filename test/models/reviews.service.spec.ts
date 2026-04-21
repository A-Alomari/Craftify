/**
 * test/models/reviews.service.spec.ts
 *
 * Unit tests for ReviewsService — creation, validation, update, delete,
 * rating stats, admin operations.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

process.env.NODE_ENV         = 'test';
process.env.CRAFTIFY_DB_PATH = ':memory:';

import { User }                  from '../../src/database/entities/user.entity';
import { ArtisanProfile }        from '../../src/database/entities/artisan-profile.entity';
import { CartItem }              from '../../src/database/entities/cart-item.entity';
import { Wishlist }              from '../../src/database/entities/wishlist.entity';
import { Review }                from '../../src/database/entities/review.entity';
import { Notification }          from '../../src/database/entities/notification.entity';
import { Message }               from '../../src/database/entities/message.entity';
import { Order }                 from '../../src/database/entities/order.entity';
import { Bid }                   from '../../src/database/entities/bid.entity';
import { Auction }               from '../../src/database/entities/auction.entity';
import { Product }               from '../../src/database/entities/product.entity';
import { Category }              from '../../src/database/entities/category.entity';
import { OrderItem }             from '../../src/database/entities/order-item.entity';
import { Shipment }              from '../../src/database/entities/shipment.entity';
import { Coupon }                from '../../src/database/entities/coupon.entity';
import { PasswordReset }         from '../../src/database/entities/password-reset.entity';
import { NewsletterSubscription } from '../../src/database/entities/newsletter-subscription.entity';

const ALL_ENTITIES = [
  User, ArtisanProfile, CartItem, Wishlist, Review, Notification, Message,
  Order, Bid, Auction, Product, Category, OrderItem, Shipment, Coupon,
  PasswordReset, NewsletterSubscription,
];

describe('ReviewsService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;
  let customerId: number;
  let artisanId: number;
  let productId: number;

  beforeAll(async () => {
    const { ReviewsModule } = await import('../../src/modules/reviews/reviews.module');
    const { ReviewsService } = await import('../../src/modules/reviews/reviews.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        ReviewsModule,
      ],
    }).compile();

    service    = module.get(ReviewsService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    await dataSource.query(`
      INSERT INTO users (name, email, password, role, status, country)
      VALUES
        ('Customer', 'review.customer@test.com', 'hashed', 'customer', 'active', 'Bahrain'),
        ('Artisan',  'review.artisan@test.com',  'hashed', 'artisan',  'active', 'Bahrain')
    `);
    const [cu] = await dataSource.query(`SELECT id FROM users WHERE email='review.customer@test.com'`);
    const [ar] = await dataSource.query(`SELECT id FROM users WHERE email='review.artisan@test.com'`);
    customerId = cu.id;
    artisanId  = ar.id;

    await dataSource.query(`
      INSERT INTO artisan_profiles (user_id, shop_name, is_approved) VALUES (${artisanId}, 'Review Shop', 1)
    `);
    await dataSource.query(`
      INSERT INTO products (artisan_id, name, description, price, stock, status)
      VALUES (${artisanId}, 'Reviewable Product', 'A reviewable product', 25.00, 10, 'approved')
    `);
    const [p] = await dataSource.query(`SELECT id FROM products WHERE name='Reviewable Product'`);
    productId = p.id;
  }, 30000);

  afterAll(async () => { await module.close(); });

  // ── create() ─────────────────────────────────────────────────────────────
  describe('create()', () => {
    it('creates a review with valid data', async () => {
      const r = await service.create({
        userId: customerId,
        productId: productId,
        rating: 5,
        title: 'Great product',
        comment: 'Loved it!',
      });
      expect(r.id).toBeGreaterThan(0);
      expect(r.user_id).toBe(customerId);
      expect(r.product_id).toBe(productId);
      expect(r.rating).toBe(5);
    });

    it('throws BadRequestException on duplicate review (same user + product)', async () => {
      await expect(
        service.create({ userId: customerId, productId: productId, rating: 4 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for rating out of range', async () => {
      await expect(
        service.create({ userId: artisanId, productId: productId, rating: 6 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for non-existent product', async () => {
      await expect(
        service.create({ userId: customerId, productId: 999999, rating: 3 }),
      ).rejects.toThrow();
    });
  });

  // ── findByProductId() ────────────────────────────────────────────────────
  describe('findByProductId()', () => {
    it('returns reviews for product', async () => {
      const result = await service.findByProductId(productId);
      expect(result).toHaveProperty('reviews');
      expect(Array.isArray(result.reviews)).toBe(true);
    });

    it('returns empty for product with no approved reviews', async () => {
      const result = await service.findByProductId(999999);
      expect(result.reviews).toHaveLength(0);
    });
  });

  // ── findByUserId() ───────────────────────────────────────────────────────
  describe('findByUserId()', () => {
    it('returns reviews written by user', async () => {
      const result = await service.findByUserId(customerId);
      expect(result).toHaveProperty('reviews');
      expect(result.reviews.length).toBeGreaterThan(0);
    });

    it('returns empty for user with no reviews', async () => {
      const result = await service.findByUserId(999999);
      expect(result.reviews).toHaveLength(0);
    });
  });

  // ── findById() ───────────────────────────────────────────────────────────
  describe('findById()', () => {
    it('returns review for valid id', async () => {
      const all = await service.findByUserId(customerId);
      const first = all.reviews[0];
      const found = await service.findById(first.id);
      expect(found.id).toBe(first.id);
    });

    it('throws NotFoundException for non-existent id', async () => {
      await expect(service.findById(999999)).rejects.toThrow();
    });
  });

  // ── getStats() ───────────────────────────────────────────────────────────
  describe('getStats()', () => {
    it('returns rating stats for product with reviews', async () => {
      // Approve the review first
      await dataSource.query(`UPDATE reviews SET is_approved=1 WHERE product_id=${productId}`);
      const stats = await service.getStats(productId);
      expect(stats).toHaveProperty('avg');
      expect(stats).toHaveProperty('count');
      expect(stats).toHaveProperty('distribution');
    });

    it('returns zero stats for product with no reviews', async () => {
      const stats = await service.getStats(999999);
      expect(stats.avg ?? stats.average ?? 0).toBe(0);
      expect(stats.count).toBe(0);
    });
  });

  // ── countByUserId() ──────────────────────────────────────────────────────
  describe('countByUserId()', () => {
    it('returns positive count for user with reviews', async () => {
      const count = await service.countByUserId(customerId);
      expect(count).toBeGreaterThan(0);
    });

    it('returns 0 for user with no reviews', async () => {
      const count = await service.countByUserId(999999);
      expect(count).toBe(0);
    });
  });

  // ── update() ─────────────────────────────────────────────────────────────
  describe('update()', () => {
    let reviewId: number;

    beforeAll(async () => {
      // Create a second product to review
      await dataSource.query(`
        INSERT INTO products (artisan_id, name, description, price, stock, status)
        VALUES (${artisanId}, 'Second Product', 'Second test product', 15.00, 5, 'approved')
      `);
      const [p2] = await dataSource.query(`SELECT id FROM products WHERE name='Second Product'`);
      const r = await service.create({ userId: artisanId, productId: p2.id, rating: 3, comment: 'ok' });
      reviewId = r.id;
    });

    it('updates rating and comment', async () => {
      const updated = await service.update(reviewId, artisanId, { rating: 4, comment: 'better' });
      expect(updated.rating).toBe(4);
      expect(updated.comment).toBe('better');
    });

    it('throws ForbiddenException when wrong user tries to update', async () => {
      await expect(
        service.update(reviewId, customerId, { rating: 1 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for invalid rating', async () => {
      await expect(
        service.update(reviewId, artisanId, { rating: 0 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── delete() ─────────────────────────────────────────────────────────────
  describe('delete()', () => {
    it('owner can delete their review', async () => {
      await dataSource.query(`
        INSERT INTO products (artisan_id, name, description, price, stock, status)
        VALUES (${artisanId}, 'Delete Review Product', 'Delete test product', 10.00, 5, 'approved')
      `);
      const [p3] = await dataSource.query(`SELECT id FROM products WHERE name='Delete Review Product'`);
      const r = await service.create({ userId: customerId, productId: p3.id, rating: 2 });
      await expect(service.delete(r.id, customerId)).resolves.not.toThrow();
    });

    it('throws ForbiddenException when wrong user tries to delete', async () => {
      const all = await service.findByUserId(artisanId);
      if (all.reviews.length === 0) return; // no review to test
      const r = all.reviews[0];
      await expect(service.delete(r.id, customerId)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── admin operations ─────────────────────────────────────────────────────
  describe('admin operations', () => {
    it('adminApprove() approves a review', async () => {
      const all = await service.findByUserId(customerId);
      if (all.reviews.length === 0) return;
      const r = all.reviews[0];
      await expect(service.adminApprove(r.id)).resolves.not.toThrow();
    });

    it('getAll() returns all reviews with pagination', async () => {
      const result = await service.getAll({ page: 1, limit: 10 });
      expect(result).toHaveProperty('reviews');
      expect(result).toHaveProperty('pagination');
    });

    it('adminDelete() removes a review', async () => {
      await dataSource.query(`
        INSERT INTO products (artisan_id, name, description, price, stock, status)
        VALUES (${artisanId}, 'Admin Delete Product', 'Admin delete test', 10.00, 5, 'approved')
      `);
      const [p4] = await dataSource.query(`SELECT id FROM products WHERE name='Admin Delete Product'`);
      const r = await service.create({ userId: artisanId, productId: p4.id, rating: 5 });
      await expect(service.adminDelete(r.id)).resolves.not.toThrow();
    });
  });
});
