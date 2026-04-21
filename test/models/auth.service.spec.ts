/**
 * test/models/auth.service.spec.ts
 *
 * Unit tests for AuthService — validateUser, register, registerArtisan,
 * forgotPassword, and resetPassword.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';

process.env.NODE_ENV         = 'test';
process.env.CRAFTIFY_DB_PATH = ':memory:';
process.env.PASSWORD_MIN_LENGTH = '6';

import { User }           from '../../src/database/entities/user.entity';
import { ArtisanProfile } from '../../src/database/entities/artisan-profile.entity';
import { CartItem }       from '../../src/database/entities/cart-item.entity';
import { PasswordReset }  from '../../src/database/entities/password-reset.entity';
import { Product }        from '../../src/database/entities/product.entity';
import { Category }       from '../../src/database/entities/category.entity';
import { Order }          from '../../src/database/entities/order.entity';
import { OrderItem }      from '../../src/database/entities/order-item.entity';
import { Shipment }       from '../../src/database/entities/shipment.entity';
import { Review }         from '../../src/database/entities/review.entity';
import { Auction }        from '../../src/database/entities/auction.entity';
import { Bid }            from '../../src/database/entities/bid.entity';
import { Wishlist }       from '../../src/database/entities/wishlist.entity';
import { Notification }   from '../../src/database/entities/notification.entity';
import { Message }        from '../../src/database/entities/message.entity';
import { Coupon }         from '../../src/database/entities/coupon.entity';
import { NewsletterSubscription } from '../../src/database/entities/newsletter-subscription.entity';

const ALL_ENTITIES = [
  User, ArtisanProfile, CartItem, PasswordReset, Product, Category,
  Order, OrderItem, Shipment, Review, Auction, Bid, Wishlist,
  Notification, Message, Coupon, NewsletterSubscription,
];

describe('AuthService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;

  beforeAll(async () => {
    const { AuthModule } = await import('../../src/auth/auth.module');
    const { AuthService } = await import('../../src/auth/auth.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        AuthModule,
      ],
    }).compile();

    service = module.get(AuthService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    // Seed an existing user
    const hashed = await bcrypt.hash('password123', 4);
    await dataSource.query(`
      INSERT INTO users (name, email, password, role, status, country)
      VALUES
        ('Existing User',    'existing-auth@test.com',  '${hashed}', 'customer', 'active',    'Bahrain'),
        ('Suspended User',   'suspended-auth@test.com', '${hashed}', 'customer', 'suspended', 'Bahrain')
    `);
  }, 30000);

  afterAll(async () => { await module.close(); });

  // ── validateUser ───────────────────────────────────────────────────────────
  describe('validateUser()', () => {
    it('returns user on correct credentials', async () => {
      const user = await service.validateUser('existing-auth@test.com', 'password123');
      expect(user).not.toBeNull();
      expect(user.email).toBe('existing-auth@test.com');
    });

    it('returns null for wrong password', async () => {
      const user = await service.validateUser('existing-auth@test.com', 'wrongpassword');
      expect(user).toBeNull();
    });

    it('returns null for non-existent email', async () => {
      const user = await service.validateUser('nobody@nowhere.com', 'anything');
      expect(user).toBeNull();
    });

    it('throws for suspended user', async () => {
      await expect(
        service.validateUser('suspended-auth@test.com', 'password123'),
      ).rejects.toThrow();
    });
  });

  // ── register (customer) ────────────────────────────────────────────────────
  describe('register()', () => {
    it('creates a new customer user', async () => {
      const unique = `newcustomer_${Date.now()}@test.com`;
      const user = await service.register({
        name: 'New Customer',
        email: unique,
        password: 'password123',
      });
      expect(user.id).toBeDefined();
      expect(user.role).toBe('customer');
    });

    it('hashes the password', async () => {
      const unique = `hashtest_${Date.now()}@test.com`;
      const user = await service.register({
        name: 'Hash Test',
        email: unique,
        password: 'myplainpassword',
      });
      const [row] = await dataSource.query(`SELECT password FROM users WHERE id=${user.id}`);
      expect(row.password).not.toBe('myplainpassword');
      const valid = await bcrypt.compare('myplainpassword', row.password);
      expect(valid).toBe(true);
    });

    it('rejects duplicate email', async () => {
      await expect(
        service.register({
          name: 'Duplicate',
          email: 'existing-auth@test.com',
          password: 'password123',
        }),
      ).rejects.toThrow();
    });

    it('rejects too-short password', async () => {
      const unique = `shortpw_${Date.now()}@test.com`;
      await expect(
        service.register({
          name: 'Short PW',
          email: unique,
          password: 'abc', // < 6 chars
        }),
      ).rejects.toThrow();
    });
  });

  // ── registerArtisan ────────────────────────────────────────────────────────
  describe('registerArtisan()', () => {
    it('creates an artisan user and profile', async () => {
      const unique = `artisan_svc_${Date.now()}@test.com`;
      const { user, artisanProfile } = await service.registerArtisan({
        name: 'New Artisan',
        email: unique,
        password: 'password123',
        shop_name: 'New Artisan Shop',
      });
      expect(user.role).toBe('artisan');
      expect(artisanProfile.shop_name).toBe('New Artisan Shop');
    });

    it('rejects duplicate artisan email', async () => {
      await expect(
        service.registerArtisan({
          name: 'Dup',
          email: 'existing-auth@test.com',
          password: 'password123',
          shop_name: 'Shop',
        }),
      ).rejects.toThrow();
    });
  });

  // ── forgotPassword ─────────────────────────────────────────────────────────
  describe('forgotPassword()', () => {
    it('creates a reset token for existing user without throwing', async () => {
      await expect(
        service.forgotPassword('existing-auth@test.com'),
      ).resolves.not.toThrow();
    });

    it('does NOT throw for non-existent email (no user disclosure)', async () => {
      await expect(
        service.forgotPassword('nobody@nowhere.com'),
      ).resolves.not.toThrow();
    });
  });

  // ── resetPassword ──────────────────────────────────────────────────────────
  describe('resetPassword()', () => {
    it('rejects invalid token', async () => {
      await expect(
        service.resetPassword('totally-invalid-token-xyz', 'newpassword123'),
      ).rejects.toThrow();
    });
  });
});
