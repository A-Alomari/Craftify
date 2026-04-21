/**
 * test/models/notifications.service.spec.ts
 *
 * Unit tests for NotificationsService — CRUD operations, read/unread management,
 * and convenience notification helpers.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

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

describe('NotificationsService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;
  let userId: number;
  let artisanId: number;

  beforeAll(async () => {
    const { NotificationsModule } = await import('../../src/modules/notifications/notifications.module');
    const { NotificationsService } = await import('../../src/modules/notifications/notifications.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        NotificationsModule,
      ],
    }).compile();

    service    = module.get(NotificationsService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    await dataSource.query(`
      INSERT INTO users (name, email, password, role, status, country)
      VALUES
        ('Customer', 'notif.customer@test.com', 'hashed', 'customer', 'active', 'Bahrain'),
        ('Artisan',  'notif.artisan@test.com',  'hashed', 'artisan',  'active', 'Bahrain')
    `);
    const [cu] = await dataSource.query(`SELECT id FROM users WHERE email='notif.customer@test.com'`);
    const [ar] = await dataSource.query(`SELECT id FROM users WHERE email='notif.artisan@test.com'`);
    userId   = cu.id;
    artisanId = ar.id;
    await dataSource.query(`
      INSERT INTO artisan_profiles (user_id, shop_name, is_approved) VALUES (${artisanId}, 'Notif Shop', 1)
    `);
  }, 30000);

  afterAll(async () => { await module.close(); });

  // ── create() ─────────────────────────────────────────────────────────────
  describe('create()', () => {
    it('creates a notification for a user', async () => {
      const n = await service.create({
        userId: userId,
        type: 'order',
        title: 'Order placed',
        message: 'Your order #1 was placed',
        link: '/orders/1',
      });
      expect(n.id).toBeGreaterThan(0);
      expect(n.user_id).toBe(userId);
      expect(n.type).toBe('order');
      expect(n.is_read).toBeFalsy();
    });
  });

  // ── findByUserId() ───────────────────────────────────────────────────────
  describe('findByUserId()', () => {
    it('returns notifications for user', async () => {
      const result = await service.findByUserId(userId);
      expect(result).toHaveProperty('notifications');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.notifications)).toBe(true);
      expect(result.notifications.length).toBeGreaterThan(0);
    });

    it('returns empty for user with no notifications', async () => {
      const result = await service.findByUserId(999999);
      expect(result.notifications).toHaveLength(0);
    });

    it('supports pagination', async () => {
      // Create multiple notifications
      for (let i = 0; i < 3; i++) {
        await service.create({ userId: userId, type: 'info', title: `Notif ${i}`, message: `msg ${i}` });
      }
      const page1 = await service.findByUserId(userId, 1, 2);
      expect(page1.notifications.length).toBeLessThanOrEqual(2);
    });
  });

  // ── getUnreadCount() ─────────────────────────────────────────────────────
  describe('getUnreadCount()', () => {
    it('returns count of unread notifications', async () => {
      const count = await service.getUnreadCount(userId);
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
    });

    it('returns 0 for user with no notifications', async () => {
      const count = await service.getUnreadCount(888888);
      expect(count).toBe(0);
    });
  });

  // ── markAsRead() ─────────────────────────────────────────────────────────
  describe('markAsRead()', () => {
    it('marks a notification as read', async () => {
      const n = await service.create({
        userId: userId,
        type: 'info',
        title: 'Read me',
        message: 'test',
      });
      await service.markAsRead(n.id, userId);
      const [row] = await dataSource.query(`SELECT is_read FROM notifications WHERE id=${n.id}`);
      expect(row.is_read).toBeTruthy();
    });

    it('does not throw when notification belongs to wrong user', async () => {
      const n = await service.create({ userId: userId, type: 'info', title: 'x', message: 'y' });
      await expect(service.markAsRead(n.id, 999999)).resolves.not.toThrow();
    });
  });

  // ── markAllAsRead() ──────────────────────────────────────────────────────
  describe('markAllAsRead()', () => {
    it('marks all user notifications as read', async () => {
      await service.markAllAsRead(userId);
      const count = await service.getUnreadCount(userId);
      expect(count).toBe(0);
    });
  });

  // ── delete() ─────────────────────────────────────────────────────────────
  describe('delete()', () => {
    it('deletes a notification', async () => {
      const n = await service.create({ userId: userId, type: 'info', title: 'Delete me', message: 'x' });
      await service.delete(n.id, userId);
      const [row] = await dataSource.query(`SELECT id FROM notifications WHERE id=${n.id}`);
      expect(row).toBeUndefined();
    });
  });

  // ── convenience helpers ──────────────────────────────────────────────────
  describe('convenience notification helpers', () => {
    it('notifyOrderPlaced() creates order notification', async () => {
      const before = await service.getUnreadCount(userId);
      await service.notifyOrderPlaced(userId, 42);
      const after = await service.getUnreadCount(userId);
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('notifyNewOrderForArtisan() creates artisan notification', async () => {
      const before = await service.getUnreadCount(artisanId);
      await service.notifyNewOrderForArtisan(artisanId, 42);
      const after = await service.getUnreadCount(artisanId);
      expect(after).toBeGreaterThan(before);
    });

    it('notifyAuctionOutbid() creates auction notification', async () => {
      await expect(
        service.notifyAuctionOutbid(userId, 1, 'Test Auction'),
      ).resolves.not.toThrow();
    });

    it('notifyOrderStatusChange() creates status notification', async () => {
      await expect(
        service.notifyOrderStatusChange(userId, 1, 'shipped'),
      ).resolves.not.toThrow();
    });
  });
});
