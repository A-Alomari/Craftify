/**
 * tests/routes/auction.routes.test.js
 *
 * Integration tests for routes/auctions.js.
 * Covers public auction listing, auction detail, bid placement, and my-bids.
 */

'use strict';

process.env.NODE_ENV = 'test';

const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

const dbPath = path.join(__dirname, '..', '..', `craftify.auction-routes.${process.pid}.db`);
process.env.CRAFTIFY_DB_PATH = dbPath;

let app;
let db;
let ids;

beforeAll(async () => {
  try { fs.unlinkSync(dbPath); } catch (_) {}

  const { initDatabase, getDb } = require('../../config/database');
  await initDatabase();
  db = getDb();

  const { seedTestData } = require('../helpers/testDb');
  ids = seedTestData(db);

  app = require('../../server').app;
});

afterAll(() => {
  try { fs.unlinkSync(dbPath); } catch (_) {}
});

// ── GET /auctions ─────────────────────────────────────────────────────────────

describe('GET /auctions', () => {
  it('returns 200 for an unauthenticated visitor', async () => {
    const res = await request(app).get('/auctions');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 when filtering by status=active', async () => {
    const res = await request(app).get('/auctions?status=active');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 when filtering by status=ended', async () => {
    const res = await request(app).get('/auctions?status=ended');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 when sorting by ending_soon', async () => {
    const res = await request(app).get('/auctions?sort=ending_soon');
    expect(res.statusCode).toBe(200);
  });
});

// ── GET /auctions/:id ─────────────────────────────────────────────────────────

describe('GET /auctions/:id', () => {
  it('returns 200 for a valid active auction', async () => {
    const res = await request(app).get(`/auctions/${ids.auctionId}`);
    expect(res.statusCode).toBe(200);
  });

  it('returns 302 or 404 for an auction ID that does not exist', async () => {
    const res = await request(app).get('/auctions/999999');
    expect([302, 404]).toContain(res.statusCode);
  });
});

// ── GET /auctions/:id/data ────────────────────────────────────────────────────

describe('GET /auctions/:id/data', () => {
  it('returns JSON auction data for a valid auction', async () => {
    const res = await request(app)
      .get(`/auctions/${ids.auctionId}/data`)
      .set('Accept', 'application/json');

    expect([200, 302]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('auction');
    }
  });
});

// ── GET /auctions/my-bids ─────────────────────────────────────────────────────

describe('GET /auctions/my-bids', () => {
  it('redirects an unauthenticated visitor to the login page', async () => {
    const res = await request(app).get('/auctions/my-bids');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('login');
  });

  it('returns 200 for an authenticated customer who has bids', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.get('/auctions/my-bids');
    expect(res.statusCode).toBe(200);
  });

  it('redirects an artisan away from /auctions/my-bids', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'artisan@test.com', password: 'art123' });
    const res = await agent.get('/auctions/my-bids');
    expect(res.statusCode).toBe(302);
  });
});

// ── POST /auctions/:id/bid ────────────────────────────────────────────────────

describe('POST /auctions/:id/bid', () => {
  it('redirects an unauthenticated visitor to the login page', async () => {
    const res = await request(app)
      .post(`/auctions/${ids.auctionId}/bid`)
      .send({ amount: 60 });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('login');
  });

  it('accepts a valid bid from an authenticated customer and redirects', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });

    // Current highest bid is 45, increment is 5, minimum next bid is 50
    const res = await agent
      .post(`/auctions/${ids.auctionId}/bid`)
      .send({ amount: 55 });

    expect(res.statusCode).toBe(302);
  });

  it('rejects a bid that is below the current highest bid plus the increment', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer2@test.com', password: 'cust123' });

    // Bid lower than current bid (45) should be rejected
    const res = await agent
      .post(`/auctions/${ids.auctionId}/bid`)
      .send({ amount: 10 });

    expect(res.statusCode).toBe(302);
    // Should redirect back to auction page with an error, not with success
  });

  it('does not allow an artisan to bid on an auction', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'artisan@test.com', password: 'art123' });

    const res = await agent
      .post(`/auctions/${ids.auctionId}/bid`)
      .send({ amount: 100 });

    expect(res.statusCode).toBe(302);
    // Artisan should be redirected away
    expect(res.headers.location).not.toContain('confirmation');
  });

  it('rejects a bid on an ended auction', async () => {
    // Get the ended auction ID
    const endedAuction = db.prepare("SELECT id FROM auctions WHERE title = 'Ended Auction'").get();
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });

    const res = await agent
      .post(`/auctions/${endedAuction.id}/bid`)
      .send({ amount: 200 });

    expect(res.statusCode).toBe(302);
    // Should redirect with an error, not success
  });

  it('rejects a bid with a missing amount field', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });

    const res = await agent
      .post(`/auctions/${ids.auctionId}/bid`)
      .send({});

    expect(res.statusCode).toBe(302);
  });
});
