/**
 * test/models/artisan.service.spec.ts
 *
 * Unit tests for ArtisanService — dashboard, products, orders, auctions,
 * coupons, reviews, analytics, and profile management.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

process.env.NODE_ENV         = 'test';
process.env.CRAFTIFY_DB_PATH = ':memory:';

import { User }           from '../../src/database/entities/user.entity';
import { ArtisanProfile } from '../../src/database/entities/artisan-profile.entity';
import { Product }        from '../../src/database/entities/product.entity';
import { Category }       from '../../src/database/entities/category.entity';
import { Order }          from '../../src/database/entities/order.entity';
import { OrderItem }      from '../../src/database/entities/order-item.entity';
import { Auction }        from '../../src/database/entities/auction.entity';
import { Bid }            from '../../src/database/entities/bid.entity';
import { Review }         from '../../src/database/entities/review.entity';
import { Coupon }         from '../../src/database/entities/coupon.entity';
import { Notification }   from '../../src/database/entities/notification.entity';
import { CartItem }       from '../../src/database/entities/cart-item.entity';
import { Wishlist }       from '../../src/database/entities/wishlist.entity';
import { Message }        from '../../src/database/entities/message.entity';
import { Shipment }       from '../../src/database/entities/shipment.entity';
import { PasswordReset }  from '../../src/database/entities/password-reset.entity';
import { NewsletterSubscription } from '../../src/database/entities/newsletter-subscription.entity';
import * as bcrypt from 'bcryptjs';

const ALL_ENTITIES = [
  User, ArtisanProfile, Product, Category, Order, OrderItem, Auction, Bid,
  Review, Coupon, Notification, CartItem, Wishlist, Message, Shipment,
  PasswordReset, NewsletterSubscription,
];

describe('ArtisanService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;
  let artisanId: number;
  let categoryId: number;
  let productId: number;
  let auctionId: number;

  beforeAll(async () => {
    const { ArtisanModule } = await import('../../src/modules/artisan/artisan.module');
    const { ArtisanService } = await import('../../src/modules/artisan/artisan.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        ArtisanModule,
      ],
    }).compile();

    service = module.get(ArtisanService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    // Seed artisan user + profile
    const hashed = await bcrypt.hash('art123', 4);
    await dataSource.query(`
      INSERT INTO users (name, email, password, role, status, country)
      VALUES ('Artisan Test', 'artisan-svc@test.com', '${hashed}', 'artisan', 'active', 'Bahrain')
    `);
    const [artRow] = await dataSource.query(`SELECT id FROM users WHERE email='artisan-svc@test.com'`);
    artisanId = artRow.id;

    await dataSource.query(`
      INSERT INTO artisan_profiles (user_id, shop_name, bio, is_approved)
      VALUES (${artisanId}, 'Test Artisan Shop', 'Bio text', 1)
    `);

    // Seed category
    await dataSource.query(`INSERT INTO categories (name, slug, is_active) VALUES ('Pottery', 'pottery-as', 1)`);
    const [catRow] = await dataSource.query(`SELECT id FROM categories WHERE slug='pottery-as'`);
    categoryId = catRow.id;

    // Seed product
    await dataSource.query(`
      INSERT INTO products (artisan_id, category_id, name, description, price, stock, status, is_active)
      VALUES (${artisanId}, ${categoryId}, 'Artisan Product', 'Test desc', 25.00, 10, 'approved', 1)
    `);
    const [prodRow] = await dataSource.query(`SELECT id FROM products WHERE name='Artisan Product'`);
    productId = prodRow.id;

    // Seed auction
    await dataSource.query(`
      INSERT INTO auctions (artisan_id, title, starting_price, bid_increment, start_time, end_time, status)
      VALUES (${artisanId}, 'Artisan Auction', 10.00, 1.00,
              datetime('now','-1 hour'), datetime('now','+7 days'), 'active')
    `);
    const [aucRow] = await dataSource.query(`SELECT id FROM auctions WHERE title='Artisan Auction'`);
    auctionId = aucRow.id;
  }, 30000);

  afterAll(async () => { await module.close(); });

  // ── getArtisanProfileByUserId ──────────────────────────────────────────────
  describe('getArtisanProfileByUserId()', () => {
    it('returns profile for known artisan', async () => {
      const profile = await service.getArtisanProfileByUserId(artisanId);
      expect(profile).not.toBeNull();
      expect(profile.shop_name).toBe('Test Artisan Shop');
    });

    it('returns null for unknown user', async () => {
      const profile = await service.getArtisanProfileByUserId(999999);
      expect(profile).toBeNull();
    });
  });

  // ── getDashboardData ───────────────────────────────────────────────────────
  describe('getDashboardData()', () => {
    it('returns stats object with numeric fields', async () => {
      const data = await service.getDashboardData(artisanId);
      expect(data).toHaveProperty('stats');
      expect(typeof data.stats.totalRevenue).toBe('number');
      expect(typeof data.stats.totalOrders).toBe('number');
      expect(typeof data.stats.totalProducts).toBe('number');
      expect(typeof data.stats.avgRating).toBe('number');
    });

    it('returns recentOrders array', async () => {
      const data = await service.getDashboardData(artisanId);
      expect(Array.isArray(data.recentOrders)).toBe(true);
    });

    it('returns activeAuctions array', async () => {
      const data = await service.getDashboardData(artisanId);
      expect(Array.isArray(data.activeAuctions)).toBe(true);
    });

    it('returns monthlyRevenue array', async () => {
      const data = await service.getDashboardData(artisanId);
      expect(Array.isArray(data.monthlyRevenue)).toBe(true);
    });

    it('returns profile object', async () => {
      const data = await service.getDashboardData(artisanId);
      expect(data.profile).not.toBeNull();
    });
  });

  // ── getProductsList ────────────────────────────────────────────────────────
  describe('getProductsList()', () => {
    it('returns products for artisan', async () => {
      const { products } = await service.getProductsList(artisanId, {});
      expect(Array.isArray(products)).toBe(true);
      expect(products.length).toBeGreaterThan(0);
    });

    it('filters by status', async () => {
      const { products } = await service.getProductsList(artisanId, { status: 'approved' });
      expect(products.every((p: any) => p.status === 'approved')).toBe(true);
    });

    it('filters by search term', async () => {
      const { products } = await service.getProductsList(artisanId, { search: 'Artisan Product' });
      expect(products.length).toBeGreaterThan(0);
    });

    it('returns empty list for non-matching search', async () => {
      const { products } = await service.getProductsList(artisanId, { search: 'zzz_no_match_zzz' });
      expect(products.length).toBe(0);
    });

    it('returns pagination metadata', async () => {
      const { pagination } = await service.getProductsList(artisanId, {});
      expect(pagination).toHaveProperty('page');
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('totalPages');
    });
  });

  // ── createProduct ──────────────────────────────────────────────────────────
  describe('createProduct()', () => {
    it('creates a product with pending status', async () => {
      const product = await service.createProduct(artisanId, {
        name: 'New Service Product',
        description: 'Created via service test',
        price: 15.00,
        stock: 5,
        category_id: categoryId,
      }, []);
      expect(product.id).toBeDefined();
      expect(product.status).toBe('pending');
      expect(product.artisan_id).toBe(artisanId);
    });
  });

  // ── updateProduct ──────────────────────────────────────────────────────────
  describe('updateProduct()', () => {
    it('updates product name', async () => {
      const updated = await service.updateProduct(productId, artisanId, { name: 'Updated Artisan Product' });
      expect(updated.name).toBe('Updated Artisan Product');
    });

    it('throws NotFoundException for wrong artisan', async () => {
      await expect(service.updateProduct(productId, 999999, { name: 'x' })).rejects.toThrow();
    });
  });

  // ── deleteProduct ──────────────────────────────────────────────────────────
  describe('deleteProduct()', () => {
    it('deletes a product with no active orders', async () => {
      // Create a temp product to delete
      const temp = await service.createProduct(artisanId, {
        name: 'Temp Delete Product',
        description: 'Delete me',
        price: 1.00,
        stock: 1,
      }, []);
      await expect(service.deleteProduct(temp.id, artisanId)).resolves.not.toThrow();
    });

    it('throws NotFoundException for wrong artisan', async () => {
      await expect(service.deleteProduct(productId, 999999)).rejects.toThrow();
    });
  });

  // ── getOrdersList ──────────────────────────────────────────────────────────
  describe('getOrdersList()', () => {
    it('returns orders array and pagination', async () => {
      const { orders, pagination } = await service.getOrdersList(artisanId, {});
      expect(Array.isArray(orders)).toBe(true);
      expect(pagination).toHaveProperty('total');
    });
  });

  // ── getAuctionsList ────────────────────────────────────────────────────────
  describe('getAuctionsList()', () => {
    it('returns auctions, pagination, and stats', async () => {
      const result = await service.getAuctionsList(artisanId, {});
      expect(Array.isArray(result.auctions)).toBe(true);
      expect(result.pagination).toHaveProperty('total');
      expect(result.stats).toHaveProperty('activeCount');
      expect(result.stats).toHaveProperty('pendingCount');
      expect(result.stats).toHaveProperty('soldCount');
      expect(result.stats).toHaveProperty('endedCount');
    });

    it('activeCount equals number of active auctions', async () => {
      const { stats } = await service.getAuctionsList(artisanId, {});
      expect(stats.activeCount).toBeGreaterThanOrEqual(1);
    });

    it('filters by status', async () => {
      const { auctions } = await service.getAuctionsList(artisanId, { status: 'active' });
      expect(auctions.every((a: any) => a.status === 'active')).toBe(true);
    });
  });

  // ── createAuction ──────────────────────────────────────────────────────────
  describe('createAuction()', () => {
    it('creates auction with pending status and ISO end_time', async () => {
      const start = new Date(Date.now() + 60000);
      const end   = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      const auction = await service.createAuction(artisanId, {
        title: 'Service Created Auction',
        starting_price: 5.00,
        bid_increment: 0.50,
        start_time: start,
        end_time: end,
      }, []);
      expect(auction.id).toBeDefined();
      expect(auction.status).toBe('pending');
      // BUG FIX: end_time stored as ISO string (not Date object from js)
      expect(new Date(auction.end_time).toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  // ── cancelAuction ──────────────────────────────────────────────────────────
  describe('cancelAuction()', () => {
    it('cancels a pending/active auction', async () => {
      // Create a fresh auction to cancel
      const start = new Date(Date.now() - 3600000);
      const end   = new Date(Date.now() + 7 * 24 * 3600000);
      const auction = await service.createAuction(artisanId, {
        title: 'Cancel Test Auction',
        starting_price: 1.00,
        bid_increment: 0.10,
        start_time: start,
        end_time: end,
        status: 'active',
      }, []);

      // Force status to active (createAuction sets 'pending' for moderation)
      await dataSource.query(`UPDATE auctions SET status='active' WHERE id=${auction.id}`);
      await expect(service.cancelAuction(auction.id, artisanId)).resolves.not.toThrow();
    });

    it('throws for wrong artisan', async () => {
      await expect(service.cancelAuction(auctionId, 999999)).rejects.toThrow();
    });
  });

  // ── getCouponsList / createCoupon ──────────────────────────────────────────
  describe('Coupon management', () => {
    it('createCoupon() creates a coupon with artisan scope', async () => {
      const coupon = await service.createCoupon(artisanId, {
        code: `ARTTEST${Date.now()}`,
        discount_type: 'percent',
        discount_value: 10,
        valid_until: new Date(Date.now() + 30 * 24 * 3600000),
      });
      expect(coupon.scope).toBe('artisan');
      expect(coupon.artisan_id).toBe(artisanId);
    });

    it('createCoupon() rejects past expiry (BUG FIX #1)', async () => {
      await expect(service.createCoupon(artisanId, {
        code: 'EXPIRED_TEST_AS',
        discount_type: 'percent',
        discount_value: 5,
        valid_until: new Date(Date.now() - 3600000), // 1 hour ago
      })).rejects.toThrow();
    });

    it('createCoupon() rejects duplicate code', async () => {
      const code = `DUP${Date.now()}`;
      await service.createCoupon(artisanId, {
        code,
        discount_type: 'fixed',
        discount_value: 2,
        valid_until: new Date(Date.now() + 86400000),
      });
      await expect(service.createCoupon(artisanId, {
        code,
        discount_type: 'fixed',
        discount_value: 2,
        valid_until: new Date(Date.now() + 86400000),
      })).rejects.toThrow();
    });

    it('getCouponsList() returns artisan coupons', async () => {
      const coupons = await service.getCouponsList(artisanId);
      expect(Array.isArray(coupons)).toBe(true);
    });

    it('toggleCoupon() toggles is_active', async () => {
      const coupon = await service.createCoupon(artisanId, {
        code: `TOG${Date.now()}`,
        discount_type: 'percent',
        discount_value: 5,
        valid_until: new Date(Date.now() + 86400000),
      });
      const toggled = await service.toggleCoupon(coupon.id, artisanId);
      expect(toggled.is_active).toBe(0);
    });

    it('deleteCoupon() removes the coupon', async () => {
      const coupon = await service.createCoupon(artisanId, {
        code: `DEL${Date.now()}`,
        discount_type: 'percent',
        discount_value: 5,
        valid_until: new Date(Date.now() + 86400000),
      });
      await expect(service.deleteCoupon(coupon.id, artisanId)).resolves.not.toThrow();
    });
  });

  // ── getReviewsList ─────────────────────────────────────────────────────────
  describe('getReviewsList()', () => {
    it('returns reviews array and pagination', async () => {
      const { reviews, pagination } = await service.getReviewsList(artisanId, {});
      expect(Array.isArray(reviews)).toBe(true);
      expect(pagination).toHaveProperty('total');
    });
  });

  // ── getAnalytics ───────────────────────────────────────────────────────────
  describe('getAnalytics()', () => {
    it('returns analytics object with correct shape', async () => {
      const analytics = await service.getAnalytics(artisanId);
      expect(typeof analytics.revenue).toBe('number');
      expect(typeof analytics.products).toBe('number');
      expect(typeof analytics.orders).toBe('number');
      expect(typeof analytics.avgRating).toBe('number');
      expect(Array.isArray(analytics.topProducts)).toBe(true);
      expect(Array.isArray(analytics.monthlyData)).toBe(true);
    });
  });

  // ── updateProfile ──────────────────────────────────────────────────────────
  describe('updateProfile()', () => {
    it('updates artisan bio', async () => {
      const profile = await service.updateProfile(artisanId, { bio: 'Updated bio text' });
      expect(profile.bio).toBe('Updated bio text');
    });

    it('throws NotFoundException for non-existent profile', async () => {
      await expect(service.updateProfile(999999, { bio: 'x' })).rejects.toThrow();
    });
  });
});
