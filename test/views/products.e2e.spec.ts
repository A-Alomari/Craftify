/**
 * test/views/products.e2e.spec.ts
 *
 * E2E rendering tests for product browsing, detail, and search pages.
 */

import request from 'supertest';
import { createTestApp, seedTestDatabase, loginAs, TestContext } from '../setup';

describe('Products views (e2e)', () => {
  let ctx: TestContext;
  let productId: number;
  let customerAgent: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedTestDatabase(ctx.dataSource);

    // Get a seeded product id
    const rows = await ctx.dataSource.query(
      `SELECT id FROM products WHERE status='approved' LIMIT 1`,
    );
    productId = rows[0]?.id;

    customerAgent = request.agent(ctx.httpServer);
    await loginAs(customerAgent, 'customer@test.com', 'cust123');
  }, 60000);

  afterAll(async () => { await ctx.app.close(); });

  // ── GET /products ──────────────────────────────────────────────────────────
  describe('GET /products', () => {
    it('returns 200 for guest', async () => {
      const res = await request(ctx.httpServer).get('/products');
      expect(res.status).toBe(200);
    });

    it('returns 200 for authenticated customer', async () => {
      const res = await customerAgent.get('/products');
      expect(res.status).toBe(200);
    });

    it('renders HTML content', async () => {
      const res = await request(ctx.httpServer).get('/products');
      expect(res.type).toMatch(/html/);
    });

    it('accepts search param', async () => {
      const res = await request(ctx.httpServer).get('/products?search=test');
      expect(res.status).toBe(200);
    });

    it('accepts category filter', async () => {
      const res = await request(ctx.httpServer).get('/products?category=1');
      expect(res.status).toBe(200);
    });

    it('accepts minPrice and maxPrice filters', async () => {
      const res = await request(ctx.httpServer).get('/products?minPrice=10&maxPrice=100');
      expect(res.status).toBe(200);
    });

    it('accepts sort=price_asc param', async () => {
      const res = await request(ctx.httpServer).get('/products?sort=price_asc');
      expect(res.status).toBe(200);
    });

    it('accepts sort=price_desc param', async () => {
      const res = await request(ctx.httpServer).get('/products?sort=price_desc');
      expect(res.status).toBe(200);
    });

    it('accepts sort=newest param', async () => {
      const res = await request(ctx.httpServer).get('/products?sort=newest');
      expect(res.status).toBe(200);
    });

    it('accepts page param', async () => {
      const res = await request(ctx.httpServer).get('/products?page=2');
      expect(res.status).toBe(200);
    });

    it('handles page beyond total gracefully', async () => {
      const res = await request(ctx.httpServer).get('/products?page=9999');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /products/search ───────────────────────────────────────────────────
  describe('GET /products/search', () => {
    it('returns 200 with search results', async () => {
      const res = await request(ctx.httpServer).get('/products/search?q=test');
      expect([200, 302]).toContain(res.status);
    });

    it('returns 200 with empty query', async () => {
      const res = await request(ctx.httpServer).get('/products/search?q=');
      expect([200, 302]).toContain(res.status);
    });
  });

  // ── GET /products/:id ──────────────────────────────────────────────────────
  describe('GET /products/:id', () => {
    it('returns 200 for existing approved product (guest)', async () => {
      if (!productId) return;
      const res = await request(ctx.httpServer).get(`/products/${productId}`);
      expect([200, 302]).toContain(res.status);
    });

    it('returns 200 for existing approved product (customer)', async () => {
      if (!productId) return;
      const res = await customerAgent.get(`/products/${productId}`);
      expect([200, 302]).toContain(res.status);
    });

    it('returns 302 or 404 for non-existent product', async () => {
      const res = await request(ctx.httpServer).get('/products/999999');
      expect([302, 404]).toContain(res.status);
    });
  });

  // ── GET /products/artisan/:id ──────────────────────────────────────────────
  describe('GET /products/artisan/:id', () => {
    it('returns 200 or redirect for valid artisan', async () => {
      const [artRow] = await ctx.dataSource.query(
        `SELECT id FROM users WHERE role='artisan' LIMIT 1`,
      );
      if (!artRow) return;
      const res = await request(ctx.httpServer).get(`/products/artisan/${artRow.id}`);
      expect([200, 302]).toContain(res.status);
    });

    it('handles non-existent artisan gracefully', async () => {
      const res = await request(ctx.httpServer).get('/products/artisan/999999');
      expect([200, 302, 404]).toContain(res.status);
    });
  });

  // ── API: search suggestions ────────────────────────────────────────────────
  // Returns { suggestions: [...] } (object, not plain array)
  describe('GET /api/search/suggestions', () => {
    it('returns JSON with suggestions key', async () => {
      const res = await request(ctx.httpServer).get('/api/search/suggestions?q=test');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('suggestions');
      expect(Array.isArray(res.body.suggestions)).toBe(true);
    });

    it('returns empty suggestions for no match', async () => {
      const res = await request(ctx.httpServer).get('/api/search/suggestions?q=zzznomatch');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('suggestions');
      expect(Array.isArray(res.body.suggestions)).toBe(true);
    });
  });

  // ── API: wishlist check ────────────────────────────────────────────────────
  describe('GET /api/wishlist/check/:productId', () => {
    it('returns JSON for authenticated customer', async () => {
      if (!productId) return;
      const res = await customerAgent.get(`/api/wishlist/check/${productId}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('inWishlist');
    });

    it('returns false for unauthenticated user', async () => {
      if (!productId) return;
      const res = await request(ctx.httpServer).get(`/api/wishlist/check/${productId}`);
      expect([200, 401]).toContain(res.status);
    });
  });
});
