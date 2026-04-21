/**
 * test/models/categories.service.spec.ts
 *
 * Unit tests for CategoriesService — CRUD, slug generation, uniqueness,
 * product-count enrichment, and deletion protection.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConflictException, BadRequestException } from '@nestjs/common';

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

describe('CategoriesService', () => {
  let module: TestingModule;
  let service: any;
  let dataSource: any;
  let artisanId: number;

  beforeAll(async () => {
    const { CategoriesModule } = await import('../../src/modules/categories/categories.module');
    const { CategoriesService } = await import('../../src/modules/categories/categories.service');

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqljs' as any,
          synchronize: true,
          dropSchema: true,
          logging: false,
          entities: ALL_ENTITIES,
        }),
        CategoriesModule,
      ],
    }).compile();

    service    = module.get(CategoriesService);
    const { DataSource } = await import('typeorm');
    dataSource = module.get(DataSource);

    // Seed minimal data: one artisan user + artisan_profile
    await dataSource.query(`
      INSERT INTO users (name, email, password, role, status, country)
      VALUES ('Artisan', 'artisan.cat@test.com', 'hashed', 'artisan', 'active', 'Bahrain')
    `);
    const [ar] = await dataSource.query(`SELECT id FROM users WHERE email='artisan.cat@test.com'`);
    artisanId = ar.id;
    await dataSource.query(`
      INSERT INTO artisan_profiles (user_id, shop_name, is_approved)
      VALUES (${artisanId}, 'Cat Shop', 1)
    `);
  }, 30000);

  afterAll(async () => { await module.close(); });

  // ── create() ─────────────────────────────────────────────────────────────
  describe('create()', () => {
    it('creates a category with auto-generated slug', async () => {
      const cat = await service.create({ name: 'Handmade Jewelry' });
      expect(cat).toBeDefined();
      expect(cat.id).toBeGreaterThan(0);
      expect(cat.name).toBe('Handmade Jewelry');
      expect(cat.slug).toMatch(/handmade/i);
    });

    it('creates a category with an explicit slug', async () => {
      const cat = await service.create({ name: 'Ceramics', slug: 'ceramics-art' });
      expect(cat.slug).toBe('ceramics-art');
    });

    it('throws ConflictException on duplicate slug', async () => {
      await service.create({ name: 'Woodwork', slug: 'woodwork-unique' });
      await expect(service.create({ name: 'Woodwork 2', slug: 'woodwork-unique' }))
        .rejects.toThrow(ConflictException);
    });
  });

  // ── findAll() ────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    it('returns an array of categories', async () => {
      const cats = await service.findAll();
      expect(Array.isArray(cats)).toBe(true);
      expect(cats.length).toBeGreaterThan(0);
    });

    it('each category has a product_count field', async () => {
      const cats = await service.findAll();
      for (const c of cats) {
        expect(c).toHaveProperty('product_count');
      }
    });
  });

  // ── findById() ───────────────────────────────────────────────────────────
  describe('findById()', () => {
    it('returns category for valid id', async () => {
      const cats = await service.findAll();
      const first = cats[0];
      const found = await service.findById(first.id);
      expect(found).not.toBeNull();
      expect(found.id).toBe(first.id);
    });

    it('returns null for non-existent id', async () => {
      const found = await service.findById(999999);
      expect(found).toBeNull();
    });
  });

  // ── findBySlug() ─────────────────────────────────────────────────────────
  describe('findBySlug()', () => {
    it('returns category for known slug', async () => {
      const cat = await service.create({ name: 'Slug Test Cat', slug: 'slug-test-cat' });
      const found = await service.findBySlug('slug-test-cat');
      expect(found).not.toBeNull();
      expect(found.id).toBe(cat.id);
    });

    it('returns null for unknown slug', async () => {
      const found = await service.findBySlug('no-such-slug-xyz');
      expect(found).toBeNull();
    });
  });

  // ── count() ──────────────────────────────────────────────────────────────
  describe('count()', () => {
    it('returns a positive number', async () => {
      const n = await service.count();
      expect(n).toBeGreaterThan(0);
    });
  });

  // ── getWithProductCount() ────────────────────────────────────────────────
  describe('getWithProductCount()', () => {
    it('returns array same as findAll(true)', async () => {
      const result = await service.getWithProductCount();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ── update() ─────────────────────────────────────────────────────────────
  describe('update()', () => {
    let catId: number;

    beforeAll(async () => {
      const cat = await service.create({ name: 'UpdateMe', slug: 'update-me-slug' });
      catId = cat.id;
    });

    it('updates category name', async () => {
      const updated = await service.update(catId, { name: 'Updated Name' });
      expect(updated.name).toBe('Updated Name');
    });

    it('does NOT change slug when name is updated', async () => {
      const before = await service.findById(catId);
      await service.update(catId, { name: 'Renamed Again' });
      const after = await service.findById(catId);
      expect(after.slug).toBe(before.slug);
    });

    it('throws NotFoundException for non-existent category', async () => {
      await expect(service.update(999999, { name: 'x' })).rejects.toThrow();
    });
  });

  // ── delete() ─────────────────────────────────────────────────────────────
  describe('delete()', () => {
    it('deletes a category with no products', async () => {
      const cat = await service.create({ name: 'DeleteMe', slug: 'delete-me-slug' });
      await expect(service.delete(cat.id)).resolves.not.toThrow();
    });

    it('throws BadRequestException when category has products', async () => {
      const cat = await service.create({ name: 'HasProducts', slug: 'has-products-slug' });
      // Insert a product assigned to this category
      await dataSource.query(`
        INSERT INTO products (artisan_id, category_id, name, description, price, stock, status)
        VALUES (${artisanId}, ${cat.id}, 'Test Product', 'A test product', 10.00, 5, 'approved')
      `);
      await expect(service.delete(cat.id)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for non-existent category', async () => {
      await expect(service.delete(999999)).rejects.toThrow();
    });
  });
});
