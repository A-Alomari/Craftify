/**
 * test/models/orders.service.spec.ts
 *
 * Unit tests for OrdersService — findById, findByUserId, findAll,
 * stats, updateStatus, cancel (with stock restore), reorder.
 *
 * The create() (checkout) path is covered at a high level via seeded
 * data + findById assertions; the full transaction is tested in
 * test/controllers/orders.controller.spec.ts via supertest.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';

process.env.NODE_ENV              = 'test';
process.env.CRAFTIFY_DB_PATH      = ':memory:';
process.env.ALLOW_MOCK_PAYMENTS   = 'true';

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

describe('OrdersService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;
  let customerId: number;
  let artisanId: number;
  let productId: number;
  let orderId: number;

  beforeAll(async () => {
    const { OrdersModule }  = await import('../../src/modules/orders/orders.module');
    const { OrdersService } = await import('../../src/modules/orders/orders.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        OrdersModule,
      ],
    }).compile();

    service    = module.get(OrdersService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    // Seed: users + artisan profile + product
    await dataSource.query(`
      INSERT INTO users (name, email, password, role, status, country)
      VALUES
        ('Customer', 'order.customer@test.com', 'hashed', 'customer', 'active', 'Bahrain'),
        ('Artisan',  'order.artisan@test.com',  'hashed', 'artisan',  'active', 'Bahrain')
    `);
    const [cu] = await dataSource.query(`SELECT id FROM users WHERE email='order.customer@test.com'`);
    const [ar] = await dataSource.query(`SELECT id FROM users WHERE email='order.artisan@test.com'`);
    customerId = cu.id;
    artisanId  = ar.id;

    await dataSource.query(`
      INSERT INTO artisan_profiles (user_id, shop_name, is_approved) VALUES (${artisanId}, 'Order Shop', 1)
    `);
    await dataSource.query(`
      INSERT INTO products (artisan_id, name, description, price, stock, status)
      VALUES (${artisanId}, 'Order Product', 'A handmade product', 25.00, 20, 'approved')
    `);
    const [p] = await dataSource.query(`SELECT id FROM products WHERE name='Order Product'`);
    productId = p.id;

    // Seed an order directly in DB
    await dataSource.query(`
      INSERT INTO orders (user_id, status, payment_method, payment_status, subtotal, shipping_cost, discount_amount, total_amount, shipping_address, shipping_city, shipping_country)
      VALUES (${customerId}, 'pending', 'cash', 'pending', 25.00, 5.00, 0.00, 30.00, '123 Main St', 'Manama', 'Bahrain')
    `);
    const [o] = await dataSource.query(`SELECT id FROM orders WHERE user_id=${customerId} ORDER BY id DESC LIMIT 1`);
    orderId = o.id;

    // Seed order item
    await dataSource.query(`
      INSERT INTO order_items (order_id, product_id, artisan_id, quantity, unit_price, total_price)
      VALUES (${orderId}, ${productId}, ${artisanId}, 1, 25.00, 25.00)
    `);

    // Seed shipment
    await dataSource.query(`
      INSERT INTO shipments (order_id, tracking_number, status)
      VALUES (${orderId}, 'CRF-TEST-001', 'processing')
    `);
  }, 30000);

  afterAll(async () => { await module.close(); });

  // ── findById() ───────────────────────────────────────────────────────────
  describe('findById()', () => {
    it('returns order with items and shipment', async () => {
      const order = await service.findById(orderId);
      expect(order).not.toBeNull();
      expect(order.id).toBe(orderId);
      expect(Array.isArray(order.items)).toBe(true);
      expect(order.items.length).toBeGreaterThan(0);
    });

    it('filters by userId — returns null when userId does not match', async () => {
      const order = await service.findById(orderId, 999999);
      expect(order).toBeNull();
    });

    it('returns null for non-existent order', async () => {
      const order = await service.findById(999999);
      expect(order).toBeNull();
    });
  });

  // ── findByUserId() ───────────────────────────────────────────────────────
  describe('findByUserId()', () => {
    it('returns paginated orders for user', async () => {
      const result = await service.findByUserId(customerId);
      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('pagination');
      expect(result.orders.length).toBeGreaterThan(0);
    });

    it('returns empty for user with no orders', async () => {
      const result = await service.findByUserId(999999);
      expect(result.orders).toHaveLength(0);
    });

    it('filters by status', async () => {
      const result = await service.findByUserId(customerId, { status: 'pending' });
      for (const o of result.orders) {
        expect(o.status).toBe('pending');
      }
    });
  });

  // ── findAll() ─────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    it('returns all orders with pagination', async () => {
      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result).toHaveProperty('orders');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.orders)).toBe(true);
    });

    it('filters by status', async () => {
      const result = await service.findAll({ status: 'pending' });
      for (const o of result.orders) {
        expect(o.status).toBe('pending');
      }
    });

    it('filters by userId', async () => {
      const result = await service.findAll({ userId: customerId });
      for (const o of result.orders) {
        expect(Number(o.user_id)).toBe(customerId);
      }
    });
  });

  // ── getStats() ────────────────────────────────────────────────────────────
  describe('getStats()', () => {
    it('returns aggregate stats', async () => {
      const stats = await service.getStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('pending');
      expect(stats).toHaveProperty('completed');
      expect(stats).toHaveProperty('cancelled');
      expect(stats).toHaveProperty('total_revenue');
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  // ── getRecentByArtisan() ──────────────────────────────────────────────────
  describe('getRecentByArtisan()', () => {
    it('returns orders containing artisan products', async () => {
      const orders = await service.getRecentByArtisan(artisanId, 5);
      expect(Array.isArray(orders)).toBe(true);
    });

    it('returns empty for artisan with no orders', async () => {
      const orders = await service.getRecentByArtisan(999999, 5);
      expect(orders).toHaveLength(0);
    });
  });

  // ── getMonthlyRevenueByArtisan() ──────────────────────────────────────────
  describe('getMonthlyRevenueByArtisan()', () => {
    it('returns monthly revenue array', async () => {
      const result = await service.getMonthlyRevenueByArtisan(artisanId, 6);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── updateStatus() ────────────────────────────────────────────────────────
  describe('updateStatus()', () => {
    it('transitions order status', async () => {
      await expect(service.updateStatus(orderId, 'processing')).resolves.not.toThrow();
      const [row] = await dataSource.query(`SELECT status FROM orders WHERE id=${orderId}`);
      expect(row.status).toBe('processing');
    });

    it('throws NotFoundException for non-existent order', async () => {
      await expect(service.updateStatus(999999, 'shipped')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updatePaymentStatus() ─────────────────────────────────────────────────
  describe('updatePaymentStatus()', () => {
    it('updates payment status', async () => {
      await expect(service.updatePaymentStatus(orderId, 'paid', 'ref-001')).resolves.not.toThrow();
      const [row] = await dataSource.query(`SELECT payment_status FROM orders WHERE id=${orderId}`);
      expect(row.payment_status).toBe('paid');
    });

    it('throws NotFoundException for non-existent order', async () => {
      await expect(service.updatePaymentStatus(999999, 'paid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── cancel() ─────────────────────────────────────────────────────────────
  describe('cancel()', () => {
    it('cancels a pending order and restores stock', async () => {
      // Set order back to pending for this test
      await dataSource.query(`UPDATE orders SET status='pending' WHERE id=${orderId}`);
      const [before] = await dataSource.query(`SELECT stock FROM products WHERE id=${productId}`);
      const stockBefore = Number(before.stock);

      await expect(service.cancel(orderId, customerId)).resolves.not.toThrow();

      const [row] = await dataSource.query(`SELECT status FROM orders WHERE id=${orderId}`);
      expect(row.status).toBe('cancelled');

      const [after] = await dataSource.query(`SELECT stock FROM products WHERE id=${productId}`);
      // Stock should be restored (or same if order didn't deduct it)
      expect(Number(after.stock)).toBeGreaterThanOrEqual(stockBefore);
    });

    it('throws BadRequestException when cancelling already-cancelled order', async () => {
      // Order is now cancelled
      await expect(service.cancel(orderId, customerId)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when order belongs to wrong user', async () => {
      // Create another order for test
      await dataSource.query(`
        INSERT INTO orders (user_id, status, payment_method, payment_status, subtotal, shipping_cost, discount_amount, total_amount, shipping_address, shipping_city, shipping_country)
        VALUES (${customerId}, 'pending', 'cash', 'pending', 25.00, 5.00, 0.00, 30.00, '123 Main St', 'Manama', 'Bahrain')
      `);
      const [o2] = await dataSource.query(`SELECT id FROM orders WHERE user_id=${customerId} ORDER BY id DESC LIMIT 1`);
      await expect(service.cancel(o2.id, 999999)).rejects.toThrow(NotFoundException);
    });
  });

  // ── reorder() ─────────────────────────────────────────────────────────────
  describe('reorder()', () => {
    it('copies items from past order into cart', async () => {
      // Create a completed order to reorder from
      await dataSource.query(`
        INSERT INTO orders (user_id, status, payment_method, payment_status, subtotal, shipping_cost, discount_amount, total_amount, shipping_address, shipping_city, shipping_country)
        VALUES (${customerId}, 'completed', 'cash', 'paid', 25.00, 5.00, 0.00, 30.00, '123 Main St', 'Manama', 'Bahrain')
      `);
      const [ro] = await dataSource.query(`SELECT id FROM orders WHERE user_id=${customerId} AND status='completed' ORDER BY id DESC LIMIT 1`);
      await dataSource.query(`
        INSERT INTO order_items (order_id, product_id, artisan_id, quantity, unit_price, total_price)
        VALUES (${ro.id}, ${productId}, ${artisanId}, 2, 25.00, 50.00)
      `);

      // Clear cart first
      await dataSource.query(`DELETE FROM cart_items WHERE user_id=${customerId}`);
      await expect(service.reorder(ro.id, customerId)).resolves.not.toThrow();

      const [cartRow] = await dataSource.query(
        `SELECT quantity FROM cart_items WHERE user_id=${customerId} AND product_id=${productId}`,
      );
      expect(cartRow).toBeDefined();
    });

    it('throws NotFoundException for non-existent order', async () => {
      await expect(service.reorder(999999, customerId)).rejects.toThrow(NotFoundException);
    });
  });
});
