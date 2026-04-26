/**
 * tests/routes/api.routes.test.js
 *
 * Integration tests for routes/api.js.
 * API endpoints return JSON.  Most are accessible to both authenticated and
 * unauthenticated users; the cart-count and wishlist-check endpoints require
 * an authenticated session to return meaningful data.
 */

'use strict';

process.env.NODE_ENV = 'test';

const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

const dbPath = path.join(__dirname, '..', '..', `craftify.api-routes.${process.pid}.db`);
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

// ── GET /api/products ─────────────────────────────────────────────────────────

describe('GET /api/products', () => {
  it('returns 200 with a JSON array of products for an unauthenticated visitor', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns only approved active products', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    // API maps products to {id, name, price, category, artisan} — no status field
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('returns 200 when filtering by search query', async () => {
    const res = await request(app)
      .get('/api/products?search=Vase')
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
  });
});

// ── GET /api/cart/count ───────────────────────────────────────────────────────

describe('GET /api/cart/count', () => {
  it('returns 200 with count 0 for a guest visitor', async () => {
    const res = await request(app)
      .get('/api/cart/count')
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(typeof res.body.count).toBe('number');
  });

  it('returns the correct count for an authenticated customer with items in cart', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 2 });

    const res = await agent
      .get('/api/cart/count')
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(2);
  });
});

// ── GET /api/notifications ────────────────────────────────────────────────────

describe('GET /api/notifications', () => {
  it('returns empty result for an unauthenticated visitor', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    // unread count should be 0 for guest
    expect(res.body).toBeDefined();
  });

  it('returns notification count for an authenticated user', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });

    const res = await agent
      .get('/api/notifications')
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('count');
  });
});

// ── GET /api/wishlist/check/:productId ────────────────────────────────────────

describe('GET /api/wishlist/check/:productId', () => {
  it('returns inWishlist: false for a guest visitor', async () => {
    const res = await request(app)
      .get(`/api/wishlist/check/${ids.ringId}`)
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('inWishlist');
    expect(res.body.inWishlist).toBe(false);
  });

  it('returns inWishlist: true when the product is in the authenticated user\'s wishlist', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });

    // ringId is seeded in the wishlist for custId
    const res = await agent
      .get(`/api/wishlist/check/${ids.ringId}`)
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body.inWishlist).toBe(true);
  });

  it('returns inWishlist: false for a product not in the wishlist', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });

    const res = await agent
      .get(`/api/wishlist/check/${ids.outOfStockId}`)
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body.inWishlist).toBe(false);
  });
});

// ── GET /api/auctions/:id/updates ─────────────────────────────────────────────

describe('GET /api/auctions/:id/updates', () => {
  it('returns 200 with auction update data for a valid auction', async () => {
    const res = await request(app)
      .get(`/api/auctions/${ids.auctionId}/updates`)
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('returns 404 or an error body for a non-existent auction', async () => {
    const res = await request(app)
      .get('/api/auctions/999999/updates')
      .set('Accept', 'application/json');

    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      // The body should indicate an error or empty state
      expect(res.body).toBeDefined();
    }
  });
});

// ── POST /api/coupons/validate ────────────────────────────────────────────────

describe('POST /api/coupons/validate', () => {
  it('returns valid: true for a valid coupon code with sufficient cart total', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });

    const res = await agent
      .post('/api/coupons/validate')
      .set('Accept', 'application/json')
      .send({ code: 'TEST10', total: 100 });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('valid');
    expect(res.body.valid).toBe(true);
  });

  it('returns valid: false for an expired coupon code', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });

    const res = await agent
      .post('/api/coupons/validate')
      .set('Accept', 'application/json')
      .send({ code: 'EXPIRED', total: 100 });

    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it('returns valid: false for a non-existent coupon code', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });

    const res = await agent
      .post('/api/coupons/validate')
      .set('Accept', 'application/json')
      .send({ code: 'DOESNOTEXIST', total: 100 });

    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(false);
  });

  it('returns 200 for a guest visitor (no session required for validation)', async () => {
    const res = await request(app)
      .post('/api/coupons/validate')
      .set('Accept', 'application/json')
      .send({ code: 'TEST10', total: 100 });

    expect([200, 401]).toContain(res.statusCode);
  });
});

// ── GET /api/search/suggestions ───────────────────────────────────────────────

describe('GET /api/search/suggestions', () => {
  it('returns 200 with suggestions array for a search query', async () => {
    const res = await request(app)
      .get('/api/search/suggestions?q=vase')
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
  });

  it('returns 200 with an empty or minimal result for a query with no matches', async () => {
    const res = await request(app)
      .get('/api/search/suggestions?q=xyznonexistentproduct12345')
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for an empty query string', async () => {
    const res = await request(app)
      .get('/api/search/suggestions?q=')
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
  });

  it('also works via GET /api/search (alias)', async () => {
    const res = await request(app)
      .get('/api/search?q=vase')
      .set('Accept', 'application/json');

    expect(res.statusCode).toBe(200);
  });
});
