/**
 * tests/routes/cart.routes.test.js
 *
 * Integration tests for routes/cart.js.
 * Covers guest cart, customer cart, coupon application, and role-based guards.
 *
 * NOTE: cartController uses camelCase `productId` in req.body (not `product_id`).
 * The coupon endpoint expects `code` (not `coupon_code`).
 */

'use strict';

process.env.NODE_ENV = 'test';

const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

const dbPath = path.join(__dirname, '..', '..', `craftify.cart-routes.${process.pid}.db`);
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

// ── GET /cart ─────────────────────────────────────────────────────────────────

describe('GET /cart', () => {
  it('returns 200 for a guest visitor (guest cart is always accessible)', async () => {
    const res = await request(app).get('/cart');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for an authenticated customer', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.get('/cart');
    expect(res.statusCode).toBe(200);
  });

  it('redirects artisan users away from the cart page', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'artisan@test.com', password: 'art123' });
    const res = await agent.get('/cart');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});

// ── POST /cart/add ────────────────────────────────────────────────────────────

describe('POST /cart/add', () => {
  it('adds an item to the cart for a guest and redirects', async () => {
    const res = await request(app)
      .post('/cart/add')
      .send({ productId: ids.vaseId, quantity: 1 });

    expect(res.statusCode).toBe(302);
  });

  it('adds an item to the cart for an authenticated customer and redirects', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });

    const res = await agent
      .post('/cart/add')
      .send({ productId: ids.ringId, quantity: 1 });

    expect(res.statusCode).toBe(302);

    const item = db.prepare(
      'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?'
    ).get(ids.custId, ids.ringId);
    expect(item).toBeDefined();
  });

  it('returns 302 and redirects to / for an artisan trying to add to cart', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'artisan@test.com', password: 'art123' });

    const res = await agent
      .post('/cart/add')
      .send({ productId: ids.vaseId, quantity: 1 });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
  });

  it('handles adding an item already in the cart by accumulating quantity', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer2@test.com', password: 'cust123' });

    await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
    await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 2 });

    const item = db.prepare(
      'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?'
    ).get(ids.cust2Id, ids.vaseId);

    expect(item).toBeDefined();
    expect(item.quantity).toBeGreaterThanOrEqual(3);
  });

  it('redirects with error when the product does not exist', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });

    const res = await agent
      .post('/cart/add')
      .send({ productId: 999999, quantity: 1 });

    expect(res.statusCode).toBe(302);
    // Should redirect back (not crash)
  });

  it('redirects with error when productId is missing from the request body', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });

    const res = await agent
      .post('/cart/add')
      .send({ quantity: 1 });

    expect(res.statusCode).toBe(302);
  });
});

// ── POST /cart/update ─────────────────────────────────────────────────────────

describe('POST /cart/update', () => {
  let customerAgent;

  beforeEach(async () => {
    customerAgent = request.agent(app);
    await customerAgent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    // Seed item into cart
    await customerAgent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
  });

  it('updates the quantity of an item in the cart and redirects', async () => {
    const res = await customerAgent
      .post('/cart/update')
      .send({ productId: ids.vaseId, quantity: 3 });

    expect(res.statusCode).toBe(302);

    const item = db.prepare(
      'SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?'
    ).get(ids.custId, ids.vaseId);
    expect(item).toBeDefined();
    expect(item.quantity).toBe(3);
  });

  it('removes the item from the cart when quantity is updated to 0', async () => {
    await customerAgent.post('/cart/add').send({ productId: ids.ringId, quantity: 2 });

    const res = await customerAgent
      .post('/cart/update')
      .send({ productId: ids.ringId, quantity: 0 });

    expect(res.statusCode).toBe(302);

    const item = db.prepare(
      'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?'
    ).get(ids.custId, ids.ringId);
    expect(item).toBeUndefined();
  });
});

// ── POST /cart/remove ─────────────────────────────────────────────────────────

describe('POST /cart/remove', () => {
  it('removes a specific item from the cart for an authenticated customer', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });

    const res = await agent
      .post('/cart/remove')
      .send({ productId: ids.vaseId });

    expect(res.statusCode).toBe(302);

    const item = db.prepare(
      'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?'
    ).get(ids.custId, ids.vaseId);
    expect(item).toBeUndefined();
  });
});

// ── POST /cart/clear ──────────────────────────────────────────────────────────

describe('POST /cart/clear', () => {
  it('removes all items from the cart for an authenticated customer', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });

    const res = await agent.post('/cart/clear');
    expect(res.statusCode).toBe(302);

    const items = db.prepare(
      'SELECT * FROM cart_items WHERE user_id = ?'
    ).all(ids.custId);
    expect(items.length).toBe(0);
  });
});

// ── POST /cart/coupon ─────────────────────────────────────────────────────────
// NOTE: cartController applyCoupon reads `req.body.code` (not coupon_code)

describe('POST /cart/coupon', () => {
  let customerAgent;

  beforeEach(async () => {
    customerAgent = request.agent(app);
    await customerAgent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    await customerAgent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
  });

  it('applies a valid coupon code and redirects', async () => {
    const res = await customerAgent
      .post('/cart/coupon')
      .send({ code: 'TEST10' });

    expect(res.statusCode).toBe(302);
  });

  it('redirects with an error when the coupon code does not exist', async () => {
    const res = await customerAgent
      .post('/cart/coupon')
      .send({ code: 'NOTACODE' });

    expect(res.statusCode).toBe(302);
  });

  it('redirects with an error when the coupon code is expired', async () => {
    const res = await customerAgent
      .post('/cart/coupon')
      .send({ code: 'EXPIRED' });

    expect(res.statusCode).toBe(302);
  });

  it('redirects with an error when the code field is empty', async () => {
    const res = await customerAgent
      .post('/cart/coupon')
      .send({ code: '' });

    expect(res.statusCode).toBe(302);
  });
});

// ── POST /cart/coupon/remove ──────────────────────────────────────────────────

describe('POST /cart/coupon/remove', () => {
  it('removes the applied coupon and redirects', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
    await agent.post('/cart/coupon').send({ code: 'TEST10' });

    const res = await agent.post('/cart/coupon/remove');
    expect(res.statusCode).toBe(302);
  });
});
