/**
 * test/controllers/auth.controller.spec.ts
 * Integration tests for AuthController routes.
 */

import request from 'supertest';
import { createTestApp, seedTestDatabase, loginAs, makeUnique, TestContext } from '../setup';

describe('AuthController (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedTestDatabase(ctx.dataSource);
  }, 60000);

  afterAll(async () => {
    await ctx.app.close();
  });

  // ── GET /auth/login ────────────────────────────────────────────────────────
  describe('GET /auth/login', () => {
    it('returns 200 and renders login form', async () => {
      const res = await request(ctx.httpServer).get('/auth/login');
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/login|sign.?in/i);
    });

    it('redirects logged-in user away from login page', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'customer@test.com', 'cust123');
      const res = await agent.get('/auth/login');
      expect([302, 301]).toContain(res.status);
    });
  });

  // ── POST /auth/login ───────────────────────────────────────────────────────
  describe('POST /auth/login', () => {
    it('redirects on valid customer credentials', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/auth/login')
        .send({ email: 'customer@test.com', password: 'cust123' });
      expect([302, 301]).toContain(res.status);
    });

    it('redirects admin to /admin/dashboard', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/auth/login')
        .send({ email: 'admin@test.com', password: 'admin123' });
      expect([302, 301]).toContain(res.status);
      expect(res.header.location).toMatch(/admin/);
    });

    it('redirects artisan to /artisan/dashboard', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/auth/login')
        .send({ email: 'artisan@test.com', password: 'art123' });
      expect([302, 301]).toContain(res.status);
      expect(res.header.location).toMatch(/artisan/);
    });

    it('stays on login with wrong password', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/auth/login')
        .send({ email: 'customer@test.com', password: 'wrongpassword' });
      expect([302, 301]).toContain(res.status);
      expect(res.header.location).toMatch(/login/);
    });

    it('stays on login with non-existent email', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/auth/login')
        .send({ email: 'nobody@nowhere.com', password: 'anything' });
      expect([302, 301]).toContain(res.status);
      expect(res.header.location).toMatch(/login/);
    });
  });

  // ── GET /auth/register ─────────────────────────────────────────────────────
  describe('GET /auth/register', () => {
    it('returns 200 and renders register form', async () => {
      const res = await request(ctx.httpServer).get('/auth/register');
      expect(res.status).toBe(200);
    });
  });

  // ── POST /auth/register ────────────────────────────────────────────────────
  describe('POST /auth/register', () => {
    it('creates a new customer and redirects', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/auth/register')
        .send({
          name: 'New Customer',
          email: makeUnique('newcustomer') + '@test.com',
          password: 'Password123',
        });
      expect([302, 301]).toContain(res.status);
      // Should NOT redirect back to register on success
      expect(res.header.location ?? '').not.toMatch(/register/);
    });

    it('rejects duplicate email and redirects back to register', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/auth/register')
        .send({
          name: 'Duplicate',
          email: 'customer@test.com',  // already exists
          password: 'Password123',
        });
      expect([302, 301]).toContain(res.status);
      expect(res.header.location ?? '').toMatch(/register/);
    });

    it('rejects empty name', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/auth/register')
        .send({
          name: '',
          email: makeUnique('empty') + '@test.com',
          password: 'Password123',
        });
      expect([302, 301, 400]).toContain(res.status);
    });
  });

  // ── POST /auth/logout ──────────────────────────────────────────────────────
  describe('POST /auth/logout', () => {
    it('logs out and redirects to /', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'customer@test.com', 'cust123');
      const res = await agent.post('/auth/logout');
      expect([302, 301]).toContain(res.status);
    });

    it('session is destroyed after logout', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'customer@test.com', 'cust123');
      await agent.post('/auth/logout');
      // Protected route should now redirect
      const res = await agent.get('/user/profile');
      expect([302, 301]).toContain(res.status);
    });
  });

  // ── GET /auth/forgot-password ──────────────────────────────────────────────
  describe('GET /auth/forgot-password', () => {
    it('returns 200', async () => {
      const res = await request(ctx.httpServer).get('/auth/forgot-password');
      expect(res.status).toBe(200);
    });
  });

  // ── POST /auth/forgot-password ─────────────────────────────────────────────
  describe('POST /auth/forgot-password', () => {
    it('redirects regardless of whether email exists (security)', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/auth/forgot-password')
        .send({ email: 'nobody@nowhere.com' });
      expect([302, 301]).toContain(res.status);
    });
  });

  // ── Auth guard ─────────────────────────────────────────────────────────────
  describe('Auth guard', () => {
    it('GET /user/profile requires login', async () => {
      const res = await request(ctx.httpServer).get('/user/profile');
      expect([302, 301, 401]).toContain(res.status);
    });

    it('GET /artisan/dashboard requires login', async () => {
      const res = await request(ctx.httpServer).get('/artisan/dashboard');
      expect([302, 301, 401]).toContain(res.status);
    });

    it('GET /admin/dashboard requires login', async () => {
      const res = await request(ctx.httpServer).get('/admin/dashboard');
      expect([302, 301, 401]).toContain(res.status);
    });

    it('GET /admin/dashboard requires admin role', async () => {
      const agent = request.agent(ctx.httpServer);
      await loginAs(agent, 'customer@test.com', 'cust123');
      const res = await agent.get('/admin/dashboard');
      expect([302, 301, 403]).toContain(res.status);
    });
  });
});
