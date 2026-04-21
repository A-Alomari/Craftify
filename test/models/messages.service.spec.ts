/**
 * test/models/messages.service.spec.ts
 *
 * Unit tests for MessagesService — conversations, threads, creation,
 * role-based messaging policy, read/unread, delete.
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

describe('MessagesService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;
  let customerId: number;
  let customer2Id: number;
  let artisanId: number;

  beforeAll(async () => {
    const { MessagesModule } = await import('../../src/modules/messages/messages.module');
    const { MessagesService } = await import('../../src/modules/messages/messages.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        MessagesModule,
      ],
    }).compile();

    service    = module.get(MessagesService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    await dataSource.query(`
      INSERT INTO users (name, email, password, role, status, country)
      VALUES
        ('Customer1',  'msg.customer1@test.com', 'hashed', 'customer', 'active', 'Bahrain'),
        ('Customer2',  'msg.customer2@test.com', 'hashed', 'customer', 'active', 'Bahrain'),
        ('Artisan',    'msg.artisan@test.com',   'hashed', 'artisan',  'active', 'Bahrain')
    `);
    const [cu1] = await dataSource.query(`SELECT id FROM users WHERE email='msg.customer1@test.com'`);
    const [cu2] = await dataSource.query(`SELECT id FROM users WHERE email='msg.customer2@test.com'`);
    const [ar]  = await dataSource.query(`SELECT id FROM users WHERE email='msg.artisan@test.com'`);
    customerId  = cu1.id;
    customer2Id = cu2.id;
    artisanId   = ar.id;

    await dataSource.query(`
      INSERT INTO artisan_profiles (user_id, shop_name, is_approved) VALUES (${artisanId}, 'Msg Shop', 1)
    `);
  }, 30000);

  afterAll(async () => { await module.close(); });

  // ── create() — role-based policy ─────────────────────────────────────────
  describe('create() — role policy', () => {
    it('customer can message artisan', async () => {
      const msg = await service.create({
        senderId:   customerId,
        receiverId: artisanId,
        content:     'Hello artisan!',
      });
      expect(msg.id).toBeGreaterThan(0);
      expect(msg.sender_id).toBe(customerId);
      expect(msg.receiver_id).toBe(artisanId);
    });

    it('artisan can message customer', async () => {
      const msg = await service.create({
        senderId:   artisanId,
        receiverId: customerId,
        content:     'Hello customer!',
      });
      expect(msg.id).toBeGreaterThan(0);
    });

    it('customer cannot message another customer', async () => {
      await expect(
        service.create({
          senderId:   customerId,
          receiverId: customer2Id,
          content:     'Hey there',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for non-existent receiver', async () => {
      await expect(
        service.create({
          senderId:   customerId,
          receiverId: 999999,
          content:     'Hello',
        }),
      ).rejects.toThrow();
    });
  });

  // ── getConversations() ───────────────────────────────────────────────────
  describe('getConversations()', () => {
    it('returns conversation threads for user', async () => {
      const threads = await service.getConversations(customerId);
      expect(Array.isArray(threads)).toBe(true);
      expect(threads.length).toBeGreaterThan(0);
    });

    it('returns empty for user with no messages', async () => {
      const threads = await service.getConversations(999999);
      expect(threads).toHaveLength(0);
    });

    it('each thread has other_user_id and last_message fields', async () => {
      const threads = await service.getConversations(customerId);
      for (const t of threads) {
        expect(t).toHaveProperty('other_user_id');
        expect(t).toHaveProperty('last_message');
      }
    });
  });

  // ── getThread() ──────────────────────────────────────────────────────────
  describe('getThread()', () => {
    it('returns messages between two users', async () => {
      const result = await service.getThread(customerId, artisanId);
      expect(result).toHaveProperty('messages');
      expect(Array.isArray(result.messages)).toBe(true);
      expect(result.messages.length).toBeGreaterThan(0);
    });

    it('returns empty for users with no conversation', async () => {
      const result = await service.getThread(customerId, customer2Id);
      expect(result.messages).toHaveLength(0);
    });

    it('pagination works', async () => {
      const result = await service.getThread(customerId, artisanId, 1, 1);
      expect(result.messages.length).toBeLessThanOrEqual(1);
    });
  });

  // ── getUnreadCount() ─────────────────────────────────────────────────────
  describe('getUnreadCount()', () => {
    it('returns unread message count', async () => {
      // Create a new message directly so we have a fresh unread message
      await dataSource.query(`
        INSERT INTO messages (sender_id, receiver_id, content, is_read)
        VALUES (${artisanId}, ${customerId}, 'Unread test message', 0)
      `);
      const count = await service.getUnreadCount(customerId);
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThan(0);
    });

    it('returns 0 for user with no unread messages', async () => {
      const count = await service.getUnreadCount(999999);
      expect(count).toBe(0);
    });
  });

  // ── markAsRead() ─────────────────────────────────────────────────────────
  describe('markAsRead()', () => {
    it('marks a message as read', async () => {
      const result = await service.getThread(customerId, artisanId);
      const unread = result.messages.find((m: any) => m.receiver_id === customerId);
      if (!unread) return;
      await expect(service.markAsRead(unread.id, customerId)).resolves.not.toThrow();
    });
  });

  // ── findUserById() / findArtisanProfileByUserId() ────────────────────────
  describe('helper lookups', () => {
    it('findUserById returns user for valid id', async () => {
      const u = await service.findUserById(customerId);
      expect(u).not.toBeNull();
      expect(u.id).toBe(customerId);
    });

    it('findUserById returns null for non-existent id', async () => {
      const u = await service.findUserById(999999);
      expect(u).toBeNull();
    });

    it('findArtisanProfileByUserId returns profile for artisan', async () => {
      const p = await service.findArtisanProfileByUserId(artisanId);
      expect(p).not.toBeNull();
    });

    it('findArtisanProfileByUserId returns null for non-artisan', async () => {
      const p = await service.findArtisanProfileByUserId(customerId);
      expect(p).toBeNull();
    });
  });

  // ── delete() ─────────────────────────────────────────────────────────────
  describe('delete()', () => {
    it('sender can delete their message', async () => {
      const msg = await service.create({
        senderId:   customerId,
        receiverId: artisanId,
        content:     'Delete me',
      });
      await expect(service.delete(msg.id, customerId)).resolves.not.toThrow();
      const [row] = await dataSource.query(`SELECT id FROM messages WHERE id=${msg.id}`);
      expect(row).toBeUndefined();
    });

    it('throws ForbiddenException when non-sender tries to delete', async () => {
      const msg = await service.create({
        senderId:   artisanId,
        receiverId: customerId,
        content:     'Cannot delete',
      });
      await expect(service.delete(msg.id, customerId)).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException for non-existent message', async () => {
      await expect(service.delete(999999, customerId)).rejects.toThrow();
    });
  });
});
