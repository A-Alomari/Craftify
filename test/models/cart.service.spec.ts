/**
 * test/models/cart.service.spec.ts
 *
 * Unit tests for CartService — add, update, remove, clear, validate,
 * merge guest cart, coupon application, and total calculation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';

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

describe('CartService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;
  let customerId: number;
  let artisanId: number;
  let productId: number;
  let product2Id: number;

  beforeAll(async () => {
    const { CartModule }    = await import('../../src/modules/cart/cart.module');
    const { CartService }   = await import('../../src/modules/cart/cart.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        CartModule,
      ],
    }).compile();

    service    = module.get(CartService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    await dataSource.query(`
      INSERT INTO users (name, email, password, role, status, country)
      VALUES
        ('Customer', 'cart.customer@test.com', 'hashed', 'customer', 'active', 'Bahrain'),
        ('Artisan',  'cart.artisan@test.com',  'hashed', 'artisan',  'active', 'Bahrain')
    `);
    const [cu] = await dataSource.query(`SELECT id FROM users WHERE email='cart.customer@test.com'`);
    const [ar] = await dataSource.query(`SELECT id FROM users WHERE email='cart.artisan@test.com'`);
    customerId = cu.id;
    artisanId  = ar.id;

    await dataSource.query(`
      INSERT INTO artisan_profiles (user_id, shop_name, is_approved) VALUES (${artisanId}, 'Cart Shop', 1)
    `);
    await dataSource.query(`
      INSERT INTO products (artisan_id, name, description, price, stock, status)
      VALUES
        (${artisanId}, 'Cart Product 1', 'A cart product', 20.00, 10, 'approved'),
        (${artisanId}, 'Cart Product 2', 'Another cart product', 35.00, 5,  'approved')
    `);
    const [p1] = await dataSource.query(`SELECT id FROM products WHERE name='Cart Product 1'`);
    const [p2] = await dataSource.query(`SELECT id FROM products WHERE name='Cart Product 2'`);
    productId  = p1.id;
    product2Id = p2.id;
  }, 30000);

  afterAll(async () => { await module.close(); });

  // ── calculateTotals() — pure function, no DB ──────────────────────────────
  describe('calculateTotals()', () => {
    it('applies $5 shipping when subtotal < $50', () => {
      const items = [{ quantity: 1, product: { price: 20 } }] as any;
      const totals = service.calculateTotals(items);
      expect(totals.subtotal).toBe(20);
      expect(totals.shipping).toBe(5);
      expect(totals.discount).toBe(0);
      expect(totals.total).toBe(25);
    });

    it('applies free shipping when subtotal >= $50', () => {
      const items = [{ quantity: 3, product: { price: 20 } }] as any;
      const totals = service.calculateTotals(items);
      expect(totals.subtotal).toBe(60);
      expect(totals.shipping).toBe(0);
    });

    it('applies coupon discount', () => {
      const items = [{ quantity: 2, product: { price: 30 } }] as any;
      const totals = service.calculateTotals(items, 10);
      expect(totals.discount).toBe(10);
      expect(totals.total).toBe(totals.subtotal + totals.shipping - 10);
    });

    it('handles empty cart', () => {
      const totals = service.calculateTotals([]);
      expect(totals.subtotal).toBe(0);
      expect(totals.shipping).toBe(5);
      expect(totals.discount).toBe(0);
      expect(totals.total).toBe(5);
    });
  });

  // ── addItem() ────────────────────────────────────────────────────────────
  describe('addItem()', () => {
    it('adds a product for a logged-in user', async () => {
      await expect(service.addItem(customerId, null, productId, 1)).resolves.not.toThrow();
    });

    it('increments quantity when same product added again', async () => {
      await service.addItem(customerId, null, productId, 1);
      const [row] = await dataSource.query(
        `SELECT quantity FROM cart_items WHERE user_id=${customerId} AND product_id=${productId}`,
      );
      expect(Number(row.quantity)).toBeGreaterThanOrEqual(2);
    });

    it('adds a product for a guest (session_id)', async () => {
      await expect(service.addItem(null, 'guest-session-001', productId, 1)).resolves.not.toThrow();
    });

    it('throws BadRequestException for non-existent product', async () => {
      await expect(service.addItem(customerId, null, 999999, 1)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for out-of-stock product', async () => {
      await dataSource.query(`
        INSERT INTO products (artisan_id, name, description, price, stock, status)
        VALUES (${artisanId}, 'No Stock', 'Out of stock product', 10.00, 0, 'approved')
      `);
      const [oos] = await dataSource.query(`SELECT id FROM products WHERE name='No Stock'`);
      await expect(service.addItem(customerId, null, oos.id, 1)).rejects.toThrow(BadRequestException);
    });
  });

  // ── getItems() ───────────────────────────────────────────────────────────
  describe('getItems()', () => {
    it('returns cart items for user', async () => {
      const items = await service.getItems(customerId, null);
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    it('returns cart items for guest session', async () => {
      const items = await service.getItems(null, 'guest-session-001');
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    });

    it('returns empty array for empty cart', async () => {
      const items = await service.getItems(null, 'empty-session');
      expect(items).toHaveLength(0);
    });
  });

  // ── getTotal() ───────────────────────────────────────────────────────────
  describe('getTotal()', () => {
    it('returns total and item_count for user', async () => {
      const result = await service.getTotal(customerId, null);
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('item_count');
      expect(result.total).toBeGreaterThan(0);
    });
  });

  // ── updateItem() ─────────────────────────────────────────────────────────
  describe('updateItem()', () => {
    it('updates item quantity', async () => {
      await service.addItem(customerId, null, product2Id, 1);
      await expect(service.updateItem(customerId, null, product2Id, 2)).resolves.not.toThrow();
      const [row] = await dataSource.query(
        `SELECT quantity FROM cart_items WHERE user_id=${customerId} AND product_id=${product2Id}`,
      );
      expect(Number(row.quantity)).toBe(2);
    });

    it('throws BadRequestException when quantity is 0', async () => {
      await service.addItem(customerId, null, product2Id, 1);
      await expect(service.updateItem(customerId, null, product2Id, 0)).rejects.toThrow(BadRequestException);
      // Clean up
      await service.removeItem(customerId, null, product2Id);
    });
  });

  // ── removeItem() ─────────────────────────────────────────────────────────
  describe('removeItem()', () => {
    it('removes a specific item from cart', async () => {
      await service.addItem(customerId, null, product2Id, 1);
      await service.removeItem(customerId, null, product2Id);
      const [row] = await dataSource.query(
        `SELECT id FROM cart_items WHERE user_id=${customerId} AND product_id=${product2Id}`,
      );
      expect(row).toBeUndefined();
    });
  });

  // ── clear() ──────────────────────────────────────────────────────────────
  describe('clear()', () => {
    it('clears all items from user cart', async () => {
      await service.addItem(customerId, null, productId, 1);
      await service.clear(customerId, null);
      const items = await service.getItems(customerId, null);
      expect(items).toHaveLength(0);
    });
  });

  // ── validateItems() ──────────────────────────────────────────────────────
  describe('validateItems()', () => {
    it('returns valid=true for purchasable items', async () => {
      await service.addItem(customerId, null, productId, 1);
      const result = await service.validateItems(customerId, null);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('returns valid=false for empty cart (cart is empty)', async () => {
      const result = await service.validateItems(null, 'totally-empty-session-xyz');
      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Your cart is empty');
    });
  });

  // ── mergeGuestCart() ─────────────────────────────────────────────────────
  describe('mergeGuestCart()', () => {
    it('merges guest cart items into user cart', async () => {
      const guestSession = 'merge-guest-session-001';
      await service.addItem(null, guestSession, product2Id, 2);

      // Ensure user has a clean slate for product2
      await service.removeItem(customerId, null, product2Id);
      await service.mergeGuestCart(customerId, guestSession);

      const [row] = await dataSource.query(
        `SELECT quantity FROM cart_items WHERE user_id=${customerId} AND product_id=${product2Id}`,
      );
      expect(row).toBeDefined();
      expect(Number(row.quantity)).toBeGreaterThan(0);
    });
  });
});
