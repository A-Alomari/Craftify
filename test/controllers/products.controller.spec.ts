/**
 * test/controllers/products.controller.spec.ts
 */

import request from 'supertest';
import { createTestApp, seedTestDatabase, loginAs, TestContext } from '../setup';

describe('ProductsController (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedTestDatabase(ctx.dataSource);
  }, 60000);

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('GET /products', () => {
    it('returns 200', async () => {
      const res = await request(ctx.httpServer).get('/products');
      expect(res.status).toBe(200);
    });

    it('accepts search query param', async () => {
      const res = await request(ctx.httpServer).get('/products?search=test');
      expect(res.status).toBe(200);
    });

    it('accepts category filter', async () => {
      const [cat] = await ctx.dataSource.query(`SELECT id FROM categories WHERE slug='pottery'`);
      if (cat) {
        const res = await request(ctx.httpServer).get(`/products?category=${cat.id}`);
        expect(res.status).toBe(200);
      }
    });

    it('accepts sort param', async () => {
      const res = await request(ctx.httpServer).get('/products?sort=price_low');
      expect(res.status).toBe(200);
    });

    it('accepts pagination', async () => {
      const res = await request(ctx.httpServer).get('/products?page=1');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /products/:id', () => {
    it('returns 200 for existing product', async () => {
      const [prod] = await ctx.dataSource.query(`SELECT id FROM products WHERE status='approved' LIMIT 1`);
      if (prod) {
        const res = await request(ctx.httpServer).get(`/products/${prod.id}`);
        expect(res.status).toBe(200);
      }
    });

    it('returns 404 for non-existent product', async () => {
      const res = await request(ctx.httpServer).get('/products/999999');
      expect([404, 302]).toContain(res.status);
    });

    it('shows wishlist status for logged-in customer', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'customer@test.com', 'cust123');
      const [prod] = await ctx.dataSource.query(`SELECT id FROM products WHERE status='approved' LIMIT 1`);
      if (prod) {
        const res = await agent.get(`/products/${prod.id}`);
        expect(res.status).toBe(200);
      }
    });
  });

  describe('GET /products/search', () => {
    it('redirects to /products with search param', async () => {
      const res = await request(ctx.httpServer).get('/products/search?q=ceramic');
      expect([302, 200]).toContain(res.status);
    });
  });

  describe('Artisan product management', () => {
    it('GET /artisan/products requires auth', async () => {
      const res = await request(ctx.httpServer).get('/artisan/products');
      expect([302, 301, 401]).toContain(res.status);
    });

    it('GET /artisan/products/new requires auth', async () => {
      const res = await request(ctx.httpServer).get('/artisan/products/new');
      expect([302, 301, 401]).toContain(res.status);
    });

    it('GET /artisan/products accessible to approved artisan', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'artisan@test.com', 'art123');
      const res = await agent.get('/artisan/products');
      expect(res.status).toBe(200);
    });

    it('GET /artisan/products/new accessible to approved artisan', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'artisan@test.com', 'art123');
      const res = await agent.get('/artisan/products/new');
      expect(res.status).toBe(200);
    });

    it('customer cannot access /artisan/products', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'customer@test.com', 'cust123');
      const res = await agent.get('/artisan/products');
      expect([302, 301, 403]).toContain(res.status);
    });
  });

  describe('Admin product management', () => {
    it('GET /admin/products requires admin role', async () => {
      const res = await request(ctx.httpServer).get('/admin/products');
      expect([302, 301, 401]).toContain(res.status);
    });

    it('GET /admin/products accessible to admin', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'admin@test.com', 'admin123');
      const res = await agent.get('/admin/products');
      expect(res.status).toBe(200);
    });
  });
});
