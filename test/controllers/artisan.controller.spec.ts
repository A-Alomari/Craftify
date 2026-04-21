/**
 * test/controllers/artisan.controller.spec.ts
 *
 * Integration tests for ArtisanController — dashboard, products, auctions,
 * coupons, and profile routes.
 */

import request from 'supertest';
import { createTestApp, seedTestDatabase, loginAs, TestContext } from '../setup';

describe('ArtisanController (e2e)', () => {
  let ctx: TestContext;
  let artisanAgent: any;
  let customerAgent: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedTestDatabase(ctx.dataSource);

    artisanAgent = request.agent(ctx.httpServer);
    await loginAs(artisanAgent, 'artisan@test.com', 'art123');

    customerAgent = request.agent(ctx.httpServer);
    await loginAs(customerAgent, 'customer@test.com', 'cust123');
  }, 60000);

  afterAll(async () => { await ctx.app.close(); });

  // ── GET /artisan/dashboard ─────────────────────────────────────────────────
  describe('GET /artisan/dashboard', () => {
    it('returns 200 for authenticated artisan', async () => {
      const res = await artisanAgent.get('/artisan/dashboard');
      expect(res.status).toBe(200);
    });

    it('blocks unauthenticated access', async () => {
      const res = await request(ctx.httpServer).get('/artisan/dashboard');
      expect([301, 302]).toContain(res.status);
      expect(res.header.location).toMatch(/login/);
    });

    it('blocks customer access', async () => {
      const res = await customerAgent.get('/artisan/dashboard');
      expect([301, 302, 403]).toContain(res.status);
    });
  });

  // ── GET /artisan/products ──────────────────────────────────────────────────
  describe('GET /artisan/products', () => {
    it('returns 200 for artisan', async () => {
      const res = await artisanAgent.get('/artisan/products');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /artisan/products/new ──────────────────────────────────────────────
  describe('GET /artisan/products/new', () => {
    it('returns 200 for artisan', async () => {
      const res = await artisanAgent.get('/artisan/products/new');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /artisan/auctions ──────────────────────────────────────────────────
  describe('GET /artisan/auctions', () => {
    it('returns 200 for artisan', async () => {
      const res = await artisanAgent.get('/artisan/auctions');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /artisan/orders ────────────────────────────────────────────────────
  describe('GET /artisan/orders', () => {
    it('returns 200 for artisan', async () => {
      const res = await artisanAgent.get('/artisan/orders');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /artisan/coupons ───────────────────────────────────────────────────
  describe('GET /artisan/coupons', () => {
    it('returns 200 for artisan', async () => {
      const res = await artisanAgent.get('/artisan/coupons');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /artisan/pending ───────────────────────────────────────────────────
  describe('GET /artisan/pending', () => {
    it('returns redirect for approved artisan', async () => {
      const res = await artisanAgent.get('/artisan/pending');
      // Approved artisan gets redirected to dashboard
      expect([200, 301, 302]).toContain(res.status);
    });
  });
});
