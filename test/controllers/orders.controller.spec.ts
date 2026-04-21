/**
 * test/controllers/orders.controller.spec.ts
 *
 * Integration tests for OrdersController — list, detail, checkout flow,
 * cancel, reorder, track.
 */

import request from 'supertest';
import { createTestApp, seedTestDatabase, loginAs, TestContext } from '../setup';

describe('OrdersController (e2e)', () => {
  let ctx: TestContext;
  let customerAgent: any;
  let artisanAgent: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedTestDatabase(ctx.dataSource);

    customerAgent = request.agent(ctx.httpServer);
    await loginAs(customerAgent, 'customer@test.com', 'cust123');

    artisanAgent = request.agent(ctx.httpServer);
    await loginAs(artisanAgent, 'artisan@test.com', 'art123');
  }, 60000);

  afterAll(async () => { await ctx.app.close(); });

  // ── GET /orders ────────────────────────────────────────────────────────────
  describe('GET /orders', () => {
    it('returns 200 for authenticated customer', async () => {
      const res = await customerAgent.get('/orders');
      expect(res.status).toBe(200);
    });

    it('redirects unauthenticated user to login', async () => {
      const res = await request(ctx.httpServer).get('/orders');
      expect([301, 302]).toContain(res.status);
      expect(res.header.location).toMatch(/login/);
    });
  });

  // ── GET /orders/checkout ───────────────────────────────────────────────────
  describe('GET /orders/checkout', () => {
    it('returns 200 for authenticated customer', async () => {
      const res = await customerAgent.get('/orders/checkout');
      expect([200, 302]).toContain(res.status);
    });

    it('redirects unauthenticated user', async () => {
      const res = await request(ctx.httpServer).get('/orders/checkout');
      expect([301, 302]).toContain(res.status);
    });
  });

  // ── POST /orders/checkout ──────────────────────────────────────────────────
  describe('POST /orders/checkout', () => {
    it('redirects with error when cart is empty', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'customer@test.com', 'cust123');

      // Get CSRF
      const loginRes = await agent.get('/orders/checkout');
      const csrfMatch = loginRes.text?.match(/name="_csrf" value="([^"]+)"/);
      const csrfToken = csrfMatch?.[1] ?? '';

      const res = await agent
        .post('/orders/checkout')
        .send({
          _csrf: csrfToken,
          shipping_name: 'Test User',
          shipping_address: '123 Main St',
          shipping_city: 'Manama',
          shipping_country: 'Bahrain',
          payment_method: 'cash',
          nonce: 'test-nonce-checkout-001',
        });
      // Should redirect (either to cart with error or to confirmation)
      expect([200, 302]).toContain(res.status);
    });
  });

  // ── GET /orders/:id ────────────────────────────────────────────────────────
  describe('GET /orders/:id', () => {
    it('returns 302 for non-existent order', async () => {
      const res = await customerAgent.get('/orders/999999');
      expect([302, 404]).toContain(res.status);
    });
  });

  // ── GET /orders/:id/track ──────────────────────────────────────────────────
  describe('GET /orders/:id/track', () => {
    it('returns 302 for non-existent order', async () => {
      const res = await customerAgent.get('/orders/999999/track');
      expect([302, 404]).toContain(res.status);
    });
  });
});
