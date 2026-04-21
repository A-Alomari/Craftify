/**
 * test/views/auctions.e2e.spec.ts
 *
 * View / rendering tests for the auction pages.
 */

import request from 'supertest';
import { createTestApp, seedTestDatabase, loginAs, TestContext } from '../setup';

describe('Auctions views (e2e)', () => {
  let ctx: TestContext;
  let customerAgent: any;

  beforeAll(async () => {
    ctx = await createTestApp();
    await seedTestDatabase(ctx.dataSource);

    customerAgent = request.agent(ctx.httpServer);
    await loginAs(customerAgent, 'customer@test.com', 'cust123');
  }, 60000);

  afterAll(async () => { await ctx.app.close(); });

  describe('GET /auctions', () => {
    it('returns 200 and renders auction list', async () => {
      const res = await request(ctx.httpServer).get('/auctions');
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/auction/i);
    });

    it('renders for authenticated users too', async () => {
      const res = await customerAgent.get('/auctions');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /auctions/:id', () => {
    it('returns 200 for a seeded active auction', async () => {
      // Find an active auction from the DB
      const [auction] = await ctx.dataSource.query(
        `SELECT id FROM auctions WHERE status='active' LIMIT 1`,
      );
      if (!auction) return; // no active auction seeded
      const res = await request(ctx.httpServer).get(`/auctions/${auction.id}`);
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/auction|bid/i);
    });

    it('redirects for non-existent auction', async () => {
      const res = await request(ctx.httpServer).get('/auctions/999999');
      expect([302, 404]).toContain(res.status);
    });
  });

  describe('GET /auctions/my-bids', () => {
    it('redirects unauthenticated user to login', async () => {
      const res = await request(ctx.httpServer).get('/auctions/my-bids');
      expect([301, 302]).toContain(res.status);
    });

    it('returns 200 for authenticated customer', async () => {
      const res = await customerAgent.get('/auctions/my-bids');
      expect(res.status).toBe(200);
    });
  });
});
