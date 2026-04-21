/**
 * test/models/wishlist.service.spec.ts
 *
 * Unit tests for WishlistService — add, remove, toggle, move-to-cart,
 * pagination, and count.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

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

describe('WishlistService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;
  let customerId: number;
  let artisanId: number;
  let productId: number;
  let product2Id: number;

  beforeAll(async () => {
    const { WishlistModule } = await import('../../src/modules/wishlist/wishlist.module');
    const { WishlistService } = await import('../../src/modules/wishlist/wishlist.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        WishlistModule,
      ],
    }).compile();

    service    = module.get(WishlistService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    await dataSource.query(`
      INSERT INTO users (name, email, password, role, status, country)
      VALUES
        ('Customer', 'wish.customer@test.com', 'hashed', 'customer', 'active', 'Bahrain'),
        ('Artisan',  'wish.artisan@test.com',  'hashed', 'artisan',  'active', 'Bahrain')
    `);
    const [cu] = await dataSource.query(`SELECT id FROM users WHERE email='wish.customer@test.com'`);
    const [ar] = await dataSource.query(`SELECT id FROM users WHERE email='wish.artisan@test.com'`);
    customerId = cu.id;
    artisanId  = ar.id;

    await dataSource.query(`
      INSERT INTO artisan_profiles (user_id, shop_name, is_approved) VALUES (${artisanId}, 'Wish Shop', 1)
    `);
    await dataSource.query(`
      INSERT INTO products (artisan_id, name, description, price, stock, status)
      VALUES
        (${artisanId}, 'Wish Product 1', 'First wish product', 20.00, 5, 'approved'),
        (${artisanId}, 'Wish Product 2', 'Second wish product', 30.00, 3, 'approved')
    `);
    const [p1] = await dataSource.query(`SELECT id FROM products WHERE name='Wish Product 1'`);
    const [p2] = await dataSource.query(`SELECT id FROM products WHERE name='Wish Product 2'`);
    productId  = p1.id;
    product2Id = p2.id;
  }, 30000);

  afterAll(async () => { await module.close(); });

  // ── add() ────────────────────────────────────────────────────────────────
  describe('add()', () => {
    it('adds a product to the wishlist', async () => {
      await expect(service.add(customerId, productId)).resolves.not.toThrow();
    });

    it('is idempotent — adding same product twice does not error', async () => {
      await expect(service.add(customerId, productId)).resolves.not.toThrow();
    });

    it('throws NotFoundException for non-existent product', async () => {
      await expect(service.add(customerId, 999999)).rejects.toThrow(NotFoundException);
    });
  });

  // ── isInWishlist() ───────────────────────────────────────────────────────
  describe('isInWishlist()', () => {
    it('returns true for product in wishlist', async () => {
      const result = await service.isInWishlist(customerId, productId);
      expect(result).toBe(true);
    });

    it('returns false for product not in wishlist', async () => {
      const result = await service.isInWishlist(customerId, 999999);
      expect(result).toBe(false);
    });
  });

  // ── count() ──────────────────────────────────────────────────────────────
  describe('count()', () => {
    it('returns positive count for user with wishlist items', async () => {
      const count = await service.count(customerId);
      expect(count).toBeGreaterThan(0);
    });

    it('returns 0 for user with empty wishlist', async () => {
      const count = await service.count(999999);
      expect(count).toBe(0);
    });
  });

  // ── findByUserId() ───────────────────────────────────────────────────────
  describe('findByUserId()', () => {
    it('returns paginated wishlist items', async () => {
      const result = await service.findByUserId(customerId);
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.items)).toBe(true);
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('returns empty for user with no wishlist items', async () => {
      const result = await service.findByUserId(999999);
      expect(result.items).toHaveLength(0);
    });

    it('pagination works', async () => {
      const result = await service.findByUserId(customerId, 1, 1);
      expect(result.items.length).toBeLessThanOrEqual(1);
    });
  });

  // ── remove() ─────────────────────────────────────────────────────────────
  describe('remove()', () => {
    it('removes a product from the wishlist', async () => {
      await service.add(customerId, product2Id);
      await service.remove(customerId, product2Id);
      const inWish = await service.isInWishlist(customerId, product2Id);
      expect(inWish).toBe(false);
    });

    it('does not throw when item not in wishlist', async () => {
      await expect(service.remove(customerId, 999999)).resolves.not.toThrow();
    });
  });

  // ── toggle() ─────────────────────────────────────────────────────────────
  describe('toggle()', () => {
    it('returns true when product is added', async () => {
      // Ensure product2 is not in wishlist
      await service.remove(customerId, product2Id);
      const added = await service.toggle(customerId, product2Id);
      expect(added).toBe(true);
    });

    it('returns false when product is removed', async () => {
      // product2 is now in wishlist from previous test
      const removed = await service.toggle(customerId, product2Id);
      expect(removed).toBe(false);
    });
  });

  // ── moveToCart() ─────────────────────────────────────────────────────────
  describe('moveToCart()', () => {
    it('moves product from wishlist to cart', async () => {
      await service.add(customerId, product2Id);
      await expect(service.moveToCart(customerId, product2Id)).resolves.not.toThrow();
      // Product should no longer be in wishlist
      const inWish = await service.isInWishlist(customerId, product2Id);
      expect(inWish).toBe(false);
      // Product should be in cart
      const [cartRow] = await dataSource.query(
        `SELECT id FROM cart_items WHERE user_id=${customerId} AND product_id=${product2Id}`,
      );
      expect(cartRow).toBeDefined();
    });

    it('throws NotFoundException for non-existent product', async () => {
      await expect(service.moveToCart(customerId, 999999)).rejects.toThrow(NotFoundException);
    });
  });
});
