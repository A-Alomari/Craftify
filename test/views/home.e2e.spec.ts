/**
 * test/views/home.e2e.spec.ts
 * E2E rendering tests for public-facing pages.
 */

import request from 'supertest';
import { createTestApp, seedTestDatabase, TestContext } from '../setup';

describe('Home pages (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedTestDatabase(ctx.dataSource);
  }, 60000);

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('GET /', () => {
    it('returns 200', async () => {
      const res = await request(ctx.httpServer).get('/');
      expect(res.status).toBe(200);
    });

    it('renders HTML page', async () => {
      const res = await request(ctx.httpServer).get('/');
      expect(res.type).toMatch(/html/);
    });
  });

  describe('GET /about', () => {
    it('returns 200', async () => {
      const res = await request(ctx.httpServer).get('/about');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /contact', () => {
    it('returns 200', async () => {
      const res = await request(ctx.httpServer).get('/contact');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /contact', () => {
    it('accepts valid form submission and redirects', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent.post('/contact').send({
        name: 'Test User',
        email: 'test@test.com',
        subject: 'Test Subject',
        message: 'This is a test message with enough content.',
      });
      expect([302, 301, 200]).toContain(res.status);
    });
  });

  describe('GET /faq', () => {
    it('returns 200', async () => {
      const res = await request(ctx.httpServer).get('/faq');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /shipping', () => {
    it('returns 200', async () => {
      const res = await request(ctx.httpServer).get('/shipping');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /terms', () => {
    it('returns 200', async () => {
      const res = await request(ctx.httpServer).get('/terms');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /privacy', () => {
    it('returns 200', async () => {
      const res = await request(ctx.httpServer).get('/privacy');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /guidelines', () => {
    it('returns 200', async () => {
      const res = await request(ctx.httpServer).get('/guidelines');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /artisans', () => {
    it('returns 200', async () => {
      const res = await request(ctx.httpServer).get('/artisans');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /subscribe', () => {
    it('accepts email subscription and redirects', async () => {
      const agent = request.agent(ctx.httpServer);
      const res = await agent
        .post('/subscribe')
        .send({ email: `sub_${Date.now()}@test.com` });
      expect([302, 301, 200]).toContain(res.status);
    });

    it('handles duplicate subscription gracefully (OR IGNORE)', async () => {
      const email = `sub2_${Date.now()}@test.com`;
      const agent = request.agent(ctx.httpServer);
      await agent.post('/subscribe').send({ email });
      const res = await agent.post('/subscribe').send({ email });
      expect([302, 301, 200]).toContain(res.status);
    });
  });

  // ── Static pages ────────────────────────────────────────────────────────────
  describe('Auctions listing', () => {
    it('GET /auctions returns 200', async () => {
      const res = await request(ctx.httpServer).get('/auctions');
      expect(res.status).toBe(200);
    });
  });

  describe('API endpoints', () => {
    it('GET /api/cart/count returns JSON', async () => {
      const res = await request(ctx.httpServer).get('/api/cart/count');
      expect(res.status).toBe(200);
      expect(res.type).toMatch(/json/);
    });

    it('GET /api/search/suggestions returns JSON array', async () => {
      const res = await request(ctx.httpServer).get('/api/search/suggestions?q=test');
      expect(res.status).toBe(200);
      expect(res.type).toMatch(/json/);
    });
  });

  // ── 404 handling ─────────────────────────────────────────────────────────────
  describe('404 handling', () => {
    it('returns 404 for unknown route', async () => {
      const res = await request(ctx.httpServer).get('/this-route-definitely-does-not-exist-xyz');
      expect([404, 302]).toContain(res.status);
    });
  });
});
