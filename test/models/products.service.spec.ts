/**
 * test/models/products.service.spec.ts
 *
 * Unit tests for ProductsService — findAll filtering/sorting, findById,
 * getByArtisan, and incrementViews.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';

process.env.NODE_ENV         = 'test';
process.env.CRAFTIFY_DB_PATH = ':memory:';

import { Product }        from '../../src/database/entities/product.entity';
import { Category }       from '../../src/database/entities/category.entity';
import { User }           from '../../src/database/entities/user.entity';
import { ArtisanProfile } from '../../src/database/entities/artisan-profile.entity';
import { Review }         from '../../src/database/entities/review.entity';
import { Wishlist }       from '../../src/database/entities/wishlist.entity';
import { CartItem }       from '../../src/database/entities/cart-item.entity';
import { Order }          from '../../src/database/entities/order.entity';
import { OrderItem }      from '../../src/database/entities/order-item.entity';
import { Shipment }       from '../../src/database/entities/shipment.entity';
import { Notification }   from '../../src/database/entities/notification.entity';
import { Message }        from '../../src/database/entities/message.entity';
import { Auction }        from '../../src/database/entities/auction.entity';
import { Bid }            from '../../src/database/entities/bid.entity';
import { Coupon }         from '../../src/database/entities/coupon.entity';
import { PasswordReset }  from '../../src/database/entities/password-reset.entity';
import { NewsletterSubscription } from '../../src/database/entities/newsletter-subscription.entity';
import * as bcrypt from 'bcryptjs';

const ALL_ENTITIES = [
  Product, Category, User, ArtisanProfile, Review, Wishlist, CartItem,
  Order, OrderItem, Shipment, Notification, Message, Auction, Bid,
  Coupon, PasswordReset, NewsletterSubscription,
];

describe('ProductsService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;
  let artisanId: number;
  let categoryId: number;
  let productId: number;

  beforeAll(async () => {
    const { ProductsModule } = await import('../../src/modules/products/products.module');
    const { ProductsService } = await import('../../src/modules/products/products.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        ProductsModule,
      ],
    }).compile();

    service = module.get(ProductsService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    // Seed artisan
    const hashed = await bcrypt.hash('art123', 4);
    await dataSource.query(`
      INSERT INTO users (name, email, password, role, status, country)
      VALUES ('Prod Service Artisan', 'prod-artisan@test.com', '${hashed}', 'artisan', 'active', 'Bahrain')
    `);
    const [artRow] = await dataSource.query(`SELECT id FROM users WHERE email='prod-artisan@test.com'`);
    artisanId = artRow.id;

    await dataSource.query(`
      INSERT INTO artisan_profiles (user_id, shop_name, bio, is_approved)
      VALUES (${artisanId}, 'Product Artisan Shop', 'Artisan bio', 1)
    `);

    // Seed categories
    await dataSource.query(`
      INSERT INTO categories (name, slug, is_active)
      VALUES ('Pottery', 'pottery-ps', 1), ('Textiles', 'textiles-ps', 1)
    `);
    const [catRow] = await dataSource.query(`SELECT id FROM categories WHERE slug='pottery-ps'`);
    categoryId = catRow.id;

    // Seed products
    await dataSource.query(`
      INSERT INTO products (artisan_id, category_id, name, description, price, stock, status, is_active, featured)
      VALUES
        (${artisanId}, ${categoryId}, 'Blue Vase', 'A beautiful blue ceramic vase', 45.00, 8, 'approved', 1, 1),
        (${artisanId}, ${categoryId}, 'Red Bowl', 'A hand-thrown red bowl', 25.00, 15, 'approved', 1, 0),
        (${artisanId}, ${categoryId}, 'Green Mug', 'Artisan green mug', 18.00, 20, 'approved', 1, 0),
        (${artisanId}, ${categoryId}, 'Pending Vase', 'Not yet approved', 30.00, 5, 'pending', 1, 0)
    `);
    const [prodRow] = await dataSource.query(`SELECT id FROM products WHERE name='Blue Vase'`);
    productId = prodRow.id;
  }, 30000);

  afterAll(async () => { await module.close(); });

  // ── findAll ────────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    it('returns approved products', async () => {
      const result = await service.findAll({});
      expect(Array.isArray(result.products)).toBe(true);
      expect(result.products.length).toBeGreaterThan(0);
      // Should only return approved
      expect(result.products.every((p: any) => p.status === 'approved')).toBe(true);
    });

    it('returns pagination metadata', async () => {
      const result = await service.findAll({});
      expect(result.pagination).toBeDefined();
    });

    it('filters by category array', async () => {
      const result = await service.findAll({ category: [categoryId] });
      expect(result.products.length).toBeGreaterThan(0);
    });

    it('filters by search term (name)', async () => {
      const result = await service.findAll({ search: 'Blue' });
      expect(result.products.length).toBeGreaterThan(0);
      expect(result.products[0].name).toMatch(/blue/i);
    });

    it('returns empty for unmatched search', async () => {
      const result = await service.findAll({ search: 'zzz_nothing_here_zzz' });
      expect(result.products.length).toBe(0);
    });

    it('filters by min_price', async () => {
      const result = await service.findAll({ min_price: 40 });
      expect(result.products.every((p: any) => parseFloat(p.price) >= 40)).toBe(true);
    });

    it('filters by max_price', async () => {
      const result = await service.findAll({ max_price: 25 });
      expect(result.products.every((p: any) => parseFloat(p.price) <= 25)).toBe(true);
    });

    it('sorts by price ascending', async () => {
      const result = await service.findAll({ sort: 'price_asc' });
      const prices = result.products.map((p: any) => parseFloat(p.price));
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
      }
    });

    it('sorts by price descending', async () => {
      const result = await service.findAll({ sort: 'price_desc' });
      const prices = result.products.map((p: any) => parseFloat(p.price));
      for (let i = 1; i < prices.length; i++) {
        expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
      }
    });

    it('returns only featured products when featured=true', async () => {
      const result = await service.findAll({ featured: true });
      expect(result.products.every((p: any) => p.featured === 1 || p.featured === true)).toBe(true);
    });

    it('paginates results correctly', async () => {
      const page1 = await service.findAll({ page: 1, limit: 2 });
      expect(page1.products.length).toBeLessThanOrEqual(2);
    });
  });

  // ── findById ───────────────────────────────────────────────────────────────
  describe('findById()', () => {
    it('returns product detail for valid id', async () => {
      const product = await service.findById(productId);
      expect(product).not.toBeNull();
      expect(product.id).toBe(productId);
      expect(product.name).toBe('Blue Vase');
    });

    it('returns null for non-existent id', async () => {
      const result = await service.findById(999999);
      expect(result).toBeNull();
    });
  });

  // ── getByArtisan ───────────────────────────────────────────────────────────
  describe('getByArtisan()', () => {
    it('returns products for artisan (includes all statuses)', async () => {
      const result = await service.getByArtisan(artisanId);
      expect(Array.isArray(result.products)).toBe(true);
      expect(result.products.length).toBeGreaterThan(0);
    });

    it('returns empty for non-existent artisan', async () => {
      const result = await service.getByArtisan(999999);
      expect(result.products.length).toBe(0);
    });
  });

  // ── getFeatured ────────────────────────────────────────────────────────────
  describe('getFeatured()', () => {
    it('returns featured products', async () => {
      const products = await service.getFeatured();
      expect(Array.isArray(products)).toBe(true);
    });
  });

  // ── getNewArrivals ─────────────────────────────────────────────────────────
  describe('getNewArrivals()', () => {
    it('returns new arrival products', async () => {
      const products = await service.getNewArrivals();
      expect(Array.isArray(products)).toBe(true);
    });
  });

  // ── incrementViews ─────────────────────────────────────────────────────────
  describe('incrementViews()', () => {
    it('increments product views without error', async () => {
      await expect(service.incrementViews(productId)).resolves.not.toThrow();
    });

    it('does not throw for non-existent product', async () => {
      await expect(service.incrementViews(999999)).resolves.not.toThrow();
    });
  });

  // ── isInWishlist ───────────────────────────────────────────────────────────
  describe('isInWishlist()', () => {
    it('returns false when product not in wishlist', async () => {
      const result = await service.isInWishlist(999, productId);
      expect(typeof result).toBe('boolean');
      expect(result).toBe(false);
    });
  });

  // ── getArtisanProfile ──────────────────────────────────────────────────────
  describe('getArtisanProfile()', () => {
    it('returns artisan profile for valid artisan user', async () => {
      const profile = await service.getArtisanProfile(artisanId);
      expect(profile).not.toBeNull();
    });

    it('returns null for non-artisan user', async () => {
      const profile = await service.getArtisanProfile(999999);
      expect(profile).toBeNull();
    });
  });

  // ── getRelated ─────────────────────────────────────────────────────────────
  describe('getRelated()', () => {
    it('returns array (may be empty for seeded product)', async () => {
      const related = await service.getRelated(productId);
      expect(Array.isArray(related)).toBe(true);
    });

    it('returns empty for non-existent product', async () => {
      const related = await service.getRelated(999999);
      expect(related.length).toBe(0);
    });
  });

  // ── getStats ───────────────────────────────────────────────────────────────
  describe('getStats()', () => {
    it('returns stats object with numeric totals', async () => {
      const stats = await service.getStats();
      expect(typeof stats.total).toBe('number');
    });
  });
});
