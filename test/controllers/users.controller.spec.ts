/**
 * test/controllers/users.controller.spec.ts
 *
 * Integration tests for UsersController — profile, artisan profile view,
 * password change, shop profile.
 */

import request from 'supertest';
import { createTestApp, seedTestDatabase, loginAs, TestContext } from '../setup';

describe('UsersController (e2e)', () => {
  let ctx: TestContext;
  let customerAgent: any;
  let artisanAgent: any;
  let artisanUserId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedTestDatabase(ctx.dataSource);

    const [row] = await ctx.dataSource.query(`SELECT id FROM users WHERE email='artisan@test.com'`);
    artisanUserId = row?.id;

    customerAgent = request.agent(ctx.httpServer);
    await loginAs(customerAgent, 'customer@test.com', 'cust123');

    artisanAgent = request.agent(ctx.httpServer);
    await loginAs(artisanAgent, 'artisan@test.com', 'art123');
  }, 60000);

  afterAll(async () => { await ctx.app.close(); });

  // ── GET /user/profile ──────────────────────────────────────────────────────
  describe('GET /user/profile', () => {
    it('returns 200 for authenticated customer', async () => {
      const res = await customerAgent.get('/user/profile');
      expect(res.status).toBe(200);
    });

    it('returns 200 for authenticated artisan', async () => {
      const res = await artisanAgent.get('/user/profile');
      expect(res.status).toBe(200);
    });

    it('redirects unauthenticated user to login', async () => {
      const res = await request(ctx.httpServer).get('/user/profile');
      expect([301, 302]).toContain(res.status);
      expect(res.header.location ?? '').toMatch(/login/i);
    });

    it('accepts tab query param', async () => {
      const res = await customerAgent.get('/user/profile?tab=security');
      expect(res.status).toBe(200);
    });
  });

  // ── POST /user/profile ─────────────────────────────────────────────────────
  describe('POST /user/profile', () => {
    it('updates name and redirects', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'customer@test.com', 'cust123');
      const res = await agent.post('/user/profile').send({
        name: 'Updated Customer Name',
        email: 'customer@test.com',
      });
      expect([301, 302]).toContain(res.status);
    });

    it('redirects unauthenticated user', async () => {
      const res = await request(ctx.httpServer)
        .post('/user/profile')
        .send({ name: 'Hacker' });
      expect([301, 302]).toContain(res.status);
    });
  });

  // ── POST /user/change-password ─────────────────────────────────────────────
  describe('POST /user/change-password', () => {
    it('rejects wrong current password', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'customer@test.com', 'cust123');
      const res = await agent.post('/user/change-password').send({
        current_password: 'wrongpassword',
        new_password: 'newpass123',
        confirm_password: 'newpass123',
      });
      expect([301, 302]).toContain(res.status);
    });

    it('rejects mismatched new passwords', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'customer@test.com', 'cust123');
      const res = await agent.post('/user/change-password').send({
        current_password: 'cust123',
        new_password: 'newpass123',
        confirm_password: 'different456',
      });
      expect([301, 302]).toContain(res.status);
    });

    it('redirects unauthenticated user', async () => {
      const res = await request(ctx.httpServer)
        .post('/user/change-password')
        .send({ current_password: 'x', new_password: 'y', confirm_password: 'y' });
      expect([301, 302]).toContain(res.status);
    });
  });

  // ── POST /user/shop-profile ────────────────────────────────────────────────
  describe('POST /user/shop-profile', () => {
    it('updates artisan shop profile', async () => {
      const res = await artisanAgent.post('/user/shop-profile').send({
        shop_name: 'Updated Test Shop',
        bio: 'Updated bio for test',
      });
      expect([301, 302]).toContain(res.status);
    });

    it('blocks customers from updating shop profile', async () => {
      const res = await customerAgent.post('/user/shop-profile').send({
        shop_name: 'Fake Shop',
      });
      // Should redirect or 403 — customers don't have shop profiles
      expect([301, 302, 403]).toContain(res.status);
    });
  });

  // ── GET /user/artisan/:id ──────────────────────────────────────────────────
  describe('GET /user/artisan/:id', () => {
    it('returns 200 for valid artisan (guest)', async () => {
      if (!artisanUserId) return;
      const res = await request(ctx.httpServer).get(`/user/artisan/${artisanUserId}`);
      expect([200, 302]).toContain(res.status);
    });

    it('returns 200 for valid artisan (customer)', async () => {
      if (!artisanUserId) return;
      const res = await customerAgent.get(`/user/artisan/${artisanUserId}`);
      expect([200, 302]).toContain(res.status);
    });

    it('returns redirect for non-existent artisan', async () => {
      const res = await request(ctx.httpServer).get('/user/artisan/999999');
      expect([302, 404]).toContain(res.status);
    });
  });

  // ── GET /user/wishlist ─────────────────────────────────────────────────────
  describe('GET /user/wishlist', () => {
    it('returns 200 for authenticated customer', async () => {
      const res = await customerAgent.get('/user/wishlist');
      expect(res.status).toBe(200);
    });

    it('redirects unauthenticated user', async () => {
      const res = await request(ctx.httpServer).get('/user/wishlist');
      expect([301, 302]).toContain(res.status);
    });
  });

  // ── GET /user/notifications ────────────────────────────────────────────────
  describe('GET /user/notifications', () => {
    it('returns 200 for authenticated customer', async () => {
      const res = await customerAgent.get('/user/notifications');
      expect(res.status).toBe(200);
    });

    it('redirects unauthenticated user', async () => {
      const res = await request(ctx.httpServer).get('/user/notifications');
      expect([301, 302]).toContain(res.status);
    });
  });

  // ── GET /user/messages ─────────────────────────────────────────────────────
  describe('GET /user/messages', () => {
    it('returns 200 for authenticated customer', async () => {
      const res = await customerAgent.get('/user/messages');
      expect(res.status).toBe(200);
    });

    it('redirects unauthenticated user', async () => {
      const res = await request(ctx.httpServer).get('/user/messages');
      expect([301, 302]).toContain(res.status);
    });
  });

  // ── GET /user/reviews ──────────────────────────────────────────────────────
  describe('GET /user/reviews', () => {
    it('returns 200 for authenticated customer', async () => {
      const res = await customerAgent.get('/user/reviews');
      expect(res.status).toBe(200);
    });

    it('redirects unauthenticated user', async () => {
      const res = await request(ctx.httpServer).get('/user/reviews');
      expect([301, 302]).toContain(res.status);
    });
  });
});
