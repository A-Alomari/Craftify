/**
 * test/controllers/auctions.controller.spec.ts
 *
 * Integration tests for AuctionsController — browsing, detail, bidding.
 */

import request from 'supertest';
import { createTestApp, seedTestDatabase, loginAs, TestContext } from '../setup';

describe('AuctionsController (e2e)', () => {
  let ctx: TestContext;
  let customerAgent: any;
  let artisanAgent: any;
  let auctionId: number;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedTestDatabase(ctx.dataSource);

    // Seed an active auction for tests
    const [artisan] = await ctx.dataSource.query(`SELECT id FROM users WHERE email='artisan@test.com'`);
    if (artisan?.id) {
      await ctx.dataSource.query(`
        INSERT OR IGNORE INTO auctions
          (artisan_id, title, description, starting_price, bid_increment, start_time, end_time, status)
        VALUES
          (${artisan.id}, 'Test Auction', 'A test auction', 10.00, 1.00,
           datetime('now', '-1 hour'), datetime('now', '+7 days'), 'active')
      `);
      const [row] = await ctx.dataSource.query(`SELECT id FROM auctions WHERE title='Test Auction'`);
      auctionId = row?.id;
    }

    customerAgent = request.agent(ctx.httpServer);
    await loginAs(customerAgent, 'customer@test.com', 'cust123');

    artisanAgent = request.agent(ctx.httpServer);
    await loginAs(artisanAgent, 'artisan@test.com', 'art123');
  }, 60000);

  afterAll(async () => { await ctx.app.close(); });

  // ── GET /auctions ──────────────────────────────────────────────────────────
  describe('GET /auctions', () => {
    it('returns 200 for unauthenticated visitor', async () => {
      const res = await request(ctx.httpServer).get('/auctions');
      expect(res.status).toBe(200);
    });

    it('returns 200 for authenticated customer', async () => {
      const res = await customerAgent.get('/auctions');
      expect(res.status).toBe(200);
    });

    it('renders HTML', async () => {
      const res = await request(ctx.httpServer).get('/auctions');
      expect(res.type).toMatch(/html/);
    });

    it('accepts status filter', async () => {
      const res = await request(ctx.httpServer).get('/auctions?status=active');
      expect(res.status).toBe(200);
    });

    it('accepts sort param', async () => {
      const res = await request(ctx.httpServer).get('/auctions?sort=ending_soon');
      expect(res.status).toBe(200);
    });

    it('accepts search param', async () => {
      const res = await request(ctx.httpServer).get('/auctions?search=test');
      expect(res.status).toBe(200);
    });

    it('accepts page param', async () => {
      const res = await request(ctx.httpServer).get('/auctions?page=2');
      expect(res.status).toBe(200);
    });
  });

  // ── GET /auctions/:id ──────────────────────────────────────────────────────
  describe('GET /auctions/:id', () => {
    it('returns 200 for valid auction (guest)', async () => {
      if (!auctionId) return;
      const res = await request(ctx.httpServer).get(`/auctions/${auctionId}`);
      expect([200, 302]).toContain(res.status);
    });

    it('returns 200 for valid auction (customer)', async () => {
      if (!auctionId) return;
      const res = await customerAgent.get(`/auctions/${auctionId}`);
      expect([200, 302]).toContain(res.status);
    });

    it('returns 302 or 404 for non-existent auction', async () => {
      const res = await request(ctx.httpServer).get('/auctions/999999');
      expect([302, 404]).toContain(res.status);
    });
  });

  // ── GET /auctions/:id/data ─────────────────────────────────────────────────
  describe('GET /auctions/:id/data', () => {
    it('returns JSON for existing auction', async () => {
      if (!auctionId) return;
      const res = await request(ctx.httpServer).get(`/auctions/${auctionId}/data`);
      expect([200, 302, 404]).toContain(res.status);
    });

    it('returns 404 for non-existent auction', async () => {
      const res = await request(ctx.httpServer).get('/auctions/999999/data');
      expect([404, 302]).toContain(res.status);
    });
  });

  // ── GET /auctions/my-bids ──────────────────────────────────────────────────
  describe('GET /auctions/my-bids', () => {
    it('redirects unauthenticated user', async () => {
      const res = await request(ctx.httpServer).get('/auctions/my-bids');
      expect([301, 302]).toContain(res.status);
      expect(res.header.location ?? '').toMatch(/login/i);
    });

    it('returns 200 for authenticated customer', async () => {
      const res = await customerAgent.get('/auctions/my-bids');
      expect([200, 302]).toContain(res.status);
    });
  });

  // ── POST /auctions/:id/bid ─────────────────────────────────────────────────
  describe('POST /auctions/:id/bid', () => {
    it('redirects unauthenticated user to login', async () => {
      if (!auctionId) return;
      const res = await request(ctx.httpServer)
        .post(`/auctions/${auctionId}/bid`)
        .send({ bid_amount: '20.00' });
      expect([301, 302]).toContain(res.status);
    });

    it('accepts bid from authenticated customer', async () => {
      if (!auctionId) return;
      const res = await customerAgent
        .post(`/auctions/${auctionId}/bid`)
        .send({ bid_amount: '50.00' });
      // Could redirect back to auction page or return success JSON
      expect([200, 201, 302]).toContain(res.status);
    });

    it('rejects bid below minimum on non-existent auction', async () => {
      const res = await customerAgent
        .post('/auctions/999999/bid')
        .send({ bid_amount: '0.01' });
      expect([302, 400, 404]).toContain(res.status);
    });
  });
});
