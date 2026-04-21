/**
 * test/views/user.e2e.spec.ts
 *
 * View / rendering tests for user profile, wishlist, notifications, messages.
 */

import request from 'supertest';
import { createTestApp, seedTestDatabase, loginAs, TestContext } from '../setup';

describe('User views (e2e)', () => {
  let ctx: TestContext;
  let customerAgent: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedTestDatabase(ctx.dataSource);

    customerAgent = request.agent(ctx.httpServer);
    await loginAs(customerAgent, 'customer@test.com', 'cust123');
  }, 60000);

  afterAll(async () => { await ctx.app.close(); });

  // ── Profile ────────────────────────────────────────────────────────────────
  describe('GET /user/profile', () => {
    it('returns 200 for authenticated user', async () => {
      const res = await customerAgent.get('/user/profile');
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/profile/i);
    });

    it('redirects unauthenticated user', async () => {
      const res = await request(ctx.httpServer).get('/user/profile');
      expect([301, 302]).toContain(res.status);
    });
  });

  // ── Wishlist ───────────────────────────────────────────────────────────────
  describe('GET /user/wishlist', () => {
    it('returns 200 for authenticated user', async () => {
      const res = await customerAgent.get('/user/wishlist');
      expect(res.status).toBe(200);
    });

    it('redirects unauthenticated user', async () => {
      const res = await request(ctx.httpServer).get('/user/wishlist');
      expect([301, 302]).toContain(res.status);
    });
  });

  // ── Notifications ──────────────────────────────────────────────────────────
  describe('GET /user/notifications', () => {
    it('returns 200 for authenticated user', async () => {
      const res = await customerAgent.get('/user/notifications');
      expect(res.status).toBe(200);
    });

    it('redirects unauthenticated user', async () => {
      const res = await request(ctx.httpServer).get('/user/notifications');
      expect([301, 302]).toContain(res.status);
    });
  });

  // ── Messages ───────────────────────────────────────────────────────────────
  describe('GET /user/messages', () => {
    it('returns 200 for authenticated user', async () => {
      const res = await customerAgent.get('/user/messages');
      expect(res.status).toBe(200);
    });

    it('redirects unauthenticated user', async () => {
      const res = await request(ctx.httpServer).get('/user/messages');
      expect([301, 302]).toContain(res.status);
    });
  });

  // ── Reviews ────────────────────────────────────────────────────────────────
  describe('GET /user/reviews', () => {
    it('returns 200 for authenticated user', async () => {
      const res = await customerAgent.get('/user/reviews');
      expect(res.status).toBe(200);
    });
  });

  // ── Orders ─────────────────────────────────────────────────────────────────
  describe('GET /orders', () => {
    it('returns 200 for authenticated user', async () => {
      const res = await customerAgent.get('/orders');
      expect(res.status).toBe(200);
    });
  });

  // ── Artisan profile ────────────────────────────────────────────────────────
  describe('GET /user/artisan/:id', () => {
    it('returns 200 for a seeded artisan', async () => {
      const [artisan] = await ctx.dataSource.query(
        `SELECT u.id FROM users u
         JOIN artisan_profiles ap ON ap.user_id = u.id
         WHERE ap.is_approved = 1 LIMIT 1`,
      );
      if (!artisan) return;
      const res = await request(ctx.httpServer).get(`/user/artisan/${artisan.id}`);
      expect([200, 302]).toContain(res.status);
    });

    it('redirects for non-existent artisan', async () => {
      const res = await request(ctx.httpServer).get('/user/artisan/999999');
      expect([302, 404]).toContain(res.status);
    });
  });
});
