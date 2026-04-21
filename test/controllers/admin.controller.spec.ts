/**
 * test/controllers/admin.controller.spec.ts
 *
 * Integration tests for AdminController — dashboard, users, products,
 * categories, artisan approval, and reports.
 */

import request from 'supertest';
import { createTestApp, seedTestDatabase, loginAs, TestContext } from '../setup';

describe('AdminController (e2e)', () => {
  let ctx: TestContext;
  let adminAgent: any;
  let customerAgent: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedTestDatabase(ctx.dataSource);

    adminAgent = request.agent(ctx.httpServer);
    await loginAs(adminAgent, 'admin@test.com', 'admin123');

    customerAgent = request.agent(ctx.httpServer);
    await loginAs(customerAgent, 'customer@test.com', 'cust123');
  }, 60000);

  afterAll(async () => { await ctx.app.close(); });

  // ── GET /admin/dashboard ───────────────────────────────────────────────────
  describe('GET /admin/dashboard', () => {
    it('returns 200 for authenticated admin', async () => {
      const res = await adminAgent.get('/admin/dashboard');
      expect(res.status).toBe(200);
    });

    it('blocks unauthenticated access', async () => {
      const res = await request(ctx.httpServer).get('/admin/dashboard');
      expect([301, 302]).toContain(res.status);
      expect(res.header.location).toMatch(/login/);
    });

    it('blocks non-admin access', async () => {
      const res = await customerAgent.get('/admin/dashboard');
      expect([301, 302, 403]).toContain(res.status);
    });
  });

  // ── GET /admin/users ───────────────────────────────────────────────────────
  describe('GET /admin/users', () => {
    it('returns 200 for admin', async () => {
      const res = await adminAgent.get('/admin/users');
      expect(res.status).toBe(200);
    });

    it('blocks non-admin', async () => {
      const res = await customerAgent.get('/admin/users');
      expect([301, 302, 403]).toContain(res.status);
    });
  });

  // ── GET /admin/products ────────────────────────────────────────────────────
  describe('GET /admin/products', () => {
    it('returns 200 for admin', async () => {
      const res = await adminAgent.get('/admin/products');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /admin/categories ──────────────────────────────────────────────────
  describe('GET /admin/categories', () => {
    it('returns 200 for admin', async () => {
      const res = await adminAgent.get('/admin/categories');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /admin/artisans ────────────────────────────────────────────────────
  describe('GET /admin/artisans', () => {
    it('returns 200 for admin', async () => {
      const res = await adminAgent.get('/admin/artisans');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /admin/orders ──────────────────────────────────────────────────────
  describe('GET /admin/orders', () => {
    it('returns 200 for admin', async () => {
      const res = await adminAgent.get('/admin/orders');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /admin/coupons ─────────────────────────────────────────────────────
  describe('GET /admin/coupons', () => {
    it('returns 200 for admin', async () => {
      const res = await adminAgent.get('/admin/coupons');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /admin/reports ─────────────────────────────────────────────────────
  describe('GET /admin/reports', () => {
    it('returns 200 for admin', async () => {
      const res = await adminAgent.get('/admin/reports');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /admin/reviews ─────────────────────────────────────────────────────
  describe('GET /admin/reviews', () => {
    it('returns 200 for admin', async () => {
      const res = await adminAgent.get('/admin/reviews');
      expect(res.status).toBe(200);
    });
  });
});
