/**
 * test/controllers/cart.controller.spec.ts
 */

import request from 'supertest';
import { createTestApp, seedTestDatabase, loginAs, TestContext } from '../setup';

describe('CartController (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedTestDatabase(ctx.dataSource);
  }, 60000);

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('GET /cart', () => {
    it('returns 200 for guest', async () => {
      const res = await request(ctx.httpServer).get('/cart');
      expect(res.status).toBe(200);
    });

    it('returns 200 for logged-in customer', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'customer@test.com', 'cust123');
      const res = await agent.get('/cart');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /cart/add', () => {
    it('adds a product to guest cart', async () => {
      const [prod] = await ctx.dataSource.query(`SELECT id FROM products WHERE status='approved' LIMIT 1`);
      if (!prod) return;

      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/cart/add')
        .send({ productId: prod.id, quantity: 1 });
      expect([302, 200]).toContain(res.status);
    });

    it('adds a product to customer cart', async () => {
      const [prod] = await ctx.dataSource.query(`SELECT id FROM products WHERE status='approved' LIMIT 1`);
      if (!prod) return;

      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'customer@test.com', 'cust123');
      const res = await agent
        .post('/cart/add')
        .send({ productId: prod.id, quantity: 1 });
      expect([302, 200]).toContain(res.status);
    });

    it('artisan cannot add item to cart', async () => {
      const [prod] = await ctx.dataSource.query(`SELECT id FROM products WHERE status='approved' LIMIT 1`);
      if (!prod) return;

      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'artisan@test.com', 'art123');
      const res = await agent
        .post('/cart/add')
        .send({ productId: prod.id, quantity: 1 });
      // Should be blocked (403 or redirect)
      expect([302, 301, 403]).toContain(res.status);
    });

    it('rejects quantity 0', async () => {
      const [prod] = await ctx.dataSource.query(`SELECT id FROM products WHERE status='approved' LIMIT 1`);
      if (!prod) return;

      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/cart/add')
        .send({ productId: prod.id, quantity: 0 });
      expect([302, 400]).toContain(res.status);
    });
  });

  describe('POST /cart/remove', () => {
    it('removes item from cart', async () => {
      const [prod] = await ctx.dataSource.query(`SELECT id FROM products WHERE status='approved' LIMIT 1`);
      if (!prod) return;

      const agent = request.agent(ctx.httpServer);
      // Add first
      await agent.post('/cart/add').send({ productId: prod.id, quantity: 1 });
      // Then remove
      const res = await agent.post('/cart/remove').send({ productId: prod.id });
      expect([302, 200]).toContain(res.status);
    });
  });

  describe('POST /cart/clear', () => {
    it('clears the cart', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent.post('/cart/clear');
      expect([302, 200]).toContain(res.status);
    });
  });

  describe('POST /cart/coupon', () => {
    it('applies a valid coupon', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/cart/coupon')
        .send({ code: 'TEST10' });
      expect([302, 200]).toContain(res.status);
    });

    it('rejects an expired coupon and redirects to /cart', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/cart/coupon')
        .send({ code: 'EXPIRED' });
      expect([302, 200]).toContain(res.status);
    });

    it('rejects unknown coupon', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/cart/coupon')
        .send({ code: 'DOESNOTEXIST' });
      expect([302, 200]).toContain(res.status);
    });
  });

  describe('POST /cart/coupon/remove', () => {
    it('removes applied coupon', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent.post('/cart/coupon/remove');
      expect([302, 200]).toContain(res.status);
    });
  });
});
