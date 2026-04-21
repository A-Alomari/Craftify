/**
 * test/models/users.service.spec.ts
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';

process.env.NODE_ENV         = 'test';
process.env.CRAFTIFY_DB_PATH = ':memory:';

import { User }           from '../../src/database/entities/user.entity';
import { ArtisanProfile } from '../../src/database/entities/artisan-profile.entity';
import { CartItem }       from '../../src/database/entities/cart-item.entity';
import { Wishlist }       from '../../src/database/entities/wishlist.entity';
import { Review }         from '../../src/database/entities/review.entity';
import { Notification }   from '../../src/database/entities/notification.entity';
import { Message }        from '../../src/database/entities/message.entity';
import { Order }          from '../../src/database/entities/order.entity';
import { Bid }            from '../../src/database/entities/bid.entity';
import { Auction }        from '../../src/database/entities/auction.entity';
import { Product }        from '../../src/database/entities/product.entity';
import { Category }       from '../../src/database/entities/category.entity';
import { OrderItem }      from '../../src/database/entities/order-item.entity';
import { Shipment }       from '../../src/database/entities/shipment.entity';
import { Coupon }         from '../../src/database/entities/coupon.entity';
import { PasswordReset }  from '../../src/database/entities/password-reset.entity';
import { NewsletterSubscription } from '../../src/database/entities/newsletter-subscription.entity';

const ALL_ENTITIES = [User, ArtisanProfile, CartItem, Wishlist, Review, Notification, Message,
  Order, Bid, Auction, Product, Category, OrderItem, Shipment, Coupon, PasswordReset, NewsletterSubscription];

describe('UsersService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;
  let testUserId: number;

  beforeAll(async () => {
    const { UsersModule } = await import('../../src/modules/users/users.module');
    const { UsersService } = await import('../../src/modules/users/users.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        UsersModule,
      ],
    }).compile();

    service = module.get(UsersService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    // Seed a test user
    const hashed = await bcrypt.hash('password123', 4);
    await dataSource.query(`
      INSERT INTO users (name, email, password, role, status, country)
      VALUES ('Test User', 'testuser@test.com', '${hashed}', 'customer', 'active', 'Bahrain')
    `);
    const [row] = await dataSource.query(`SELECT id FROM users WHERE email='testuser@test.com'`);
    testUserId = row.id;
  }, 30000);

  afterAll(async () => {
    await module.close();
  });

  describe('findById()', () => {
    it('returns user for valid id', async () => {
      const user = await service.findById(testUserId);
      expect(user).not.toBeNull();
      expect(user.email).toBe('testuser@test.com');
    });

    it('returns null for non-existent id', async () => {
      await expect(service.findById(999999)).rejects.toThrow();
    });
  });

  describe('findByEmail()', () => {
    it('returns user for known email', async () => {
      const user = await service.findByEmail('testuser@test.com');
      expect(user).not.toBeNull();
      expect(user!.id).toBe(testUserId);
    });

    it('returns null for unknown email', async () => {
      const user = await service.findByEmail('nobody@nowhere.com');
      expect(user).toBeNull();
    });
  });

  describe('update()', () => {
    it('updates user name', async () => {
      await service.update(testUserId, { name: 'Updated Name' });
      const user = await service.findById(testUserId);
      expect(user.name).toBe('Updated Name');
    });

    it('updates city and country', async () => {
      await service.update(testUserId, { city: 'Riffa', country: 'Bahrain' });
      const user = await service.findById(testUserId);
      expect(user.city).toBe('Riffa');
    });
  });

  describe('changePassword()', () => {
    it('changes password with correct current password', async () => {
      await expect(
        service.changePassword(testUserId, 'password123', 'newpassword456'),
      ).resolves.not.toThrow();

      // Verify new password works
      const [row] = await dataSource.query(`SELECT password FROM users WHERE id=${testUserId}`);
      const valid = await bcrypt.compare('newpassword456', row.password);
      expect(valid).toBe(true);
    });

    it('rejects wrong current password', async () => {
      await expect(
        service.changePassword(testUserId, 'wrongpassword', 'newpassword789'),
      ).rejects.toThrow();
    });

    it('rejects empty new password', async () => {
      await expect(
        service.changePassword(testUserId, 'newpassword456', ''),
      ).rejects.toThrow();
    });
  });

  describe('getProfile()', () => {
    it('returns user and artisanProfile (null for customer)', async () => {
      const result = await service.getProfile(testUserId);
      expect(result).toHaveProperty('user');
      expect(result.user.id).toBe(testUserId);
      // customers have no artisan profile
      expect(result.artisanProfile).toBeFalsy();
    });
  });
});
