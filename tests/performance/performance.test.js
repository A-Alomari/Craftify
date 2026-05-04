/**
 * tests/performance/performance.test.js
 *
 * Performance Testing for the Craftify E-Commerce Platform.
 *
 * Strategy:
 *   - Each test records wall-clock time (Date.now()) around a Supertest request.
 *   - Thresholds are intentionally generous (≤ 500 ms) to stay reliable in CI
 *     while still catching catastrophically slow responses.
 *   - A separate "throughput" group sends 10 sequential requests and asserts
 *     the average stays under the per-request threshold.
 *   - DB-level benchmark tests exercise the most expensive model queries
 *     (Product.findAll with filters, Auction.findAll, etc.) directly.
 *
 * Run alone:
 *   npx jest tests/performance/performance.test.js --runInBand --verbose
 */

'use strict';

process.env.NODE_ENV = 'test';

const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

// ── Isolated DB ───────────────────────────────────────────────────────────────
const DB_PATH = path.join(
  __dirname, '..', '..',
  `craftify.perf.${process.pid}.db`
);
process.env.CRAFTIFY_DB_PATH = DB_PATH;

const RESPONSE_TIME_THRESHOLD_MS = 500;   // max acceptable ms per request
const AVERAGE_TIME_THRESHOLD_MS  = 300;   // max acceptable average over 10 reps
const DB_QUERY_THRESHOLD_MS      = 50;    // max acceptable ms for a single DB query

let app, db, ids;

// ── Seed helpers ──────────────────────────────────────────────────────────────
beforeAll(async () => {
  try { fs.unlinkSync(DB_PATH); } catch (_) {}

  const { initDatabase, getDb } = require('../../config/database');
  await initDatabase();
  db = getDb();

  const bcrypt = require('bcryptjs');
  const h = (pw) => bcrypt.hashSync(pw, 4); // cost-4 is fast for tests
  const now = Date.now();
  const DAY = 86400000;

  // Categories
  db.prepare(
    'INSERT INTO categories (name,slug,description,is_active) VALUES (?,?,?,1)'
  ).run('Pottery', 'pottery-perf', 'Perf pottery');
  db.prepare(
    'INSERT INTO categories (name,slug,description,is_active) VALUES (?,?,?,1)'
  ).run('Jewelry', 'jewelry-perf', 'Perf jewelry');

  // Users
  db.prepare(
    'INSERT INTO users (name,email,password,role,status,shipping_address,city,country) VALUES (?,?,?,?,?,?,?,?)'
  ).run('PerfAdmin', 'perfadmin@perf.com', h('admin123'), 'admin', 'active', '1 Admin Rd', 'Manama', 'Bahrain');
  db.prepare(
    'INSERT INTO users (name,email,password,role,status,shipping_address,city,country) VALUES (?,?,?,?,?,?,?,?)'
  ).run('PerfCustomer', 'perfcust@perf.com', h('cust123'), 'customer', 'active', '2 Cust Rd', 'Manama', 'Bahrain');
  db.prepare(
    'INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)'
  ).run('PerfArtisan', 'perfart@perf.com', h('art123'), 'artisan', 'active');

  const custId = db.prepare('SELECT id FROM users WHERE email=?').get('perfcust@perf.com').id;
  const artId  = db.prepare('SELECT id FROM users WHERE email=?').get('perfart@perf.com').id;
  const potId  = db.prepare('SELECT id FROM categories WHERE slug=?').get('pottery-perf').id;

  db.prepare(
    'INSERT INTO artisan_profiles (user_id,shop_name,bio,location,is_approved) VALUES (?,?,?,?,1)'
  ).run(artId, 'Perf Shop', 'Perf bio', 'Manama');

  // Insert 20 products to give the product-list query real work to do
  for (let i = 1; i <= 20; i++) {
    db.prepare(
      'INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active) VALUES (?,?,?,?,?,?,?,?,1)'
    ).run(artId, potId, `Perf Vase ${i}`, `Desc ${i}`, 40 + i, 10, '[]', 'approved');
  }

  const firstProductId = db.prepare(
    "SELECT id FROM products WHERE name='Perf Vase 1'"
  ).get().id;
  ids = { custId, artId, potId, firstProductId };

  // Active auction
  db.prepare(
    'INSERT INTO auctions (product_id,artisan_id,title,starting_price,bid_increment,start_time,end_time,status) VALUES (?,?,?,?,?,?,?,?)'
  ).run(
    firstProductId, artId, 'Perf Auction', 30, 5,
    new Date(now - DAY).toISOString(),
    new Date(now + 3 * DAY).toISOString(),
    'active'
  );

  app = require('../../server').app;
});

afterAll(() => {
  try { fs.unlinkSync(DB_PATH); } catch (_) {}
});

// ── Utility: measure single request time ─────────────────────────────────────
async function measureRequest(req) {
  const start = Date.now();
  const res   = await req;
  return { elapsed: Date.now() - start, res };
}

// =============================================================================
// 1. RESPONSE TIME — individual page loads
// =============================================================================
describe('Performance: Page Response Times (threshold ≤ 500 ms)', () => {

  test('GET / (home page) responds within threshold', async () => {
    const { elapsed, res } = await measureRequest(request(app).get('/'));
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThanOrEqual(RESPONSE_TIME_THRESHOLD_MS);
  });

  test('GET /products (product listing) responds within threshold', async () => {
    const { elapsed, res } = await measureRequest(request(app).get('/products'));
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThanOrEqual(RESPONSE_TIME_THRESHOLD_MS);
  });

  test('GET /products/:id (product detail) responds within threshold', async () => {
    const { elapsed, res } = await measureRequest(
      request(app).get(`/products/${ids.firstProductId}`)
    );
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThanOrEqual(RESPONSE_TIME_THRESHOLD_MS);
  });

  test('GET /auctions (auction listing) responds within threshold', async () => {
    const { elapsed, res } = await measureRequest(request(app).get('/auctions'));
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThanOrEqual(RESPONSE_TIME_THRESHOLD_MS);
  });

  test('GET /cart (shopping cart) responds within threshold', async () => {
    const { elapsed, res } = await measureRequest(request(app).get('/cart'));
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThanOrEqual(RESPONSE_TIME_THRESHOLD_MS);
  });

  test('GET /auth/login (login page) responds within threshold', async () => {
    const { elapsed, res } = await measureRequest(request(app).get('/auth/login'));
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThanOrEqual(RESPONSE_TIME_THRESHOLD_MS);
  });

  test('GET /auth/register (register page) responds within threshold', async () => {
    const { elapsed, res } = await measureRequest(request(app).get('/auth/register'));
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThanOrEqual(RESPONSE_TIME_THRESHOLD_MS);
  });

  test('GET /products?search=Perf (filtered product search) responds within threshold', async () => {
    const { elapsed, res } = await measureRequest(
      request(app).get('/products').query({ search: 'Perf' })
    );
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThanOrEqual(RESPONSE_TIME_THRESHOLD_MS);
  });

  test('GET /products?category_id=X&minPrice=40&maxPrice=55 (multi-filter) responds within threshold', async () => {
    const { elapsed, res } = await measureRequest(
      request(app).get('/products').query({
        category_id: ids.potId,
        minPrice: 40,
        maxPrice: 55
      })
    );
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThanOrEqual(RESPONSE_TIME_THRESHOLD_MS);
  });
});

// =============================================================================
// 2. THROUGHPUT — 10 sequential requests must average under 300 ms
// =============================================================================
describe('Performance: Throughput (10 sequential requests, avg ≤ 300 ms)', () => {

  test('GET / — 10 sequential requests average within threshold', async () => {
    const times = [];
    for (let i = 0; i < 10; i++) {
      const { elapsed } = await measureRequest(request(app).get('/'));
      times.push(elapsed);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBeLessThanOrEqual(AVERAGE_TIME_THRESHOLD_MS);
  });

  test('GET /products — 10 sequential requests average within threshold', async () => {
    const times = [];
    for (let i = 0; i < 10; i++) {
      const { elapsed } = await measureRequest(request(app).get('/products'));
      times.push(elapsed);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBeLessThanOrEqual(AVERAGE_TIME_THRESHOLD_MS);
  });

  test('GET /auctions — 10 sequential requests average within threshold', async () => {
    const times = [];
    for (let i = 0; i < 10; i++) {
      const { elapsed } = await measureRequest(request(app).get('/auctions'));
      times.push(elapsed);
    }
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    expect(avg).toBeLessThanOrEqual(AVERAGE_TIME_THRESHOLD_MS);
  });
});

// =============================================================================
// 3. DATABASE QUERY PERFORMANCE — direct model layer benchmarks
// =============================================================================
describe('Performance: DB Query Layer (threshold ≤ 50 ms per query)', () => {

  test('Product.findAll with status filter executes within threshold', () => {
    const Product = require('../../models/Product');
    const start   = Date.now();
    const results = Product.findAll({ status: 'approved' });
    const elapsed = Date.now() - start;
    expect(results.length).toBeGreaterThanOrEqual(20);
    expect(elapsed).toBeLessThanOrEqual(DB_QUERY_THRESHOLD_MS);
  });

  test('Product.findAll with search + price filter executes within threshold', () => {
    const Product = require('../../models/Product');
    const start   = Date.now();
    Product.findAll({ search: 'Perf', minPrice: 40, maxPrice: 60 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThanOrEqual(DB_QUERY_THRESHOLD_MS);
  });

  test('Product.findById executes within threshold', () => {
    const Product = require('../../models/Product');
    const start   = Date.now();
    const p = Product.findById(ids.firstProductId);
    const elapsed = Date.now() - start;
    expect(p).toBeTruthy();
    expect(elapsed).toBeLessThanOrEqual(DB_QUERY_THRESHOLD_MS);
  });

  test('Auction.findAll executes within threshold', () => {
    const Auction = require('../../models/Auction');
    const start   = Date.now();
    Auction.findAll({ active: true });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThanOrEqual(DB_QUERY_THRESHOLD_MS);
  });

  test('User.findByEmail executes within threshold', () => {
    const User  = require('../../models/User');
    const start = Date.now();
    User.findByEmail('perfcust@perf.com');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThanOrEqual(DB_QUERY_THRESHOLD_MS);
  });
});

// =============================================================================
// 4. AUTHENTICATED ROUTE PERFORMANCE — verifies session overhead is minimal
// =============================================================================
describe('Performance: Authenticated Routes (threshold ≤ 500 ms)', () => {

  let authenticatedAgent;

  beforeAll(async () => {
    authenticatedAgent = request.agent(app);
    await authenticatedAgent
      .post('/auth/login')
      .send({ email: 'perfcust@perf.com', password: 'cust123' });
  });

  test('Authenticated GET /cart responds within threshold', async () => {
    const start   = Date.now();
    const res     = await authenticatedAgent.get('/cart');
    const elapsed = Date.now() - start;
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThanOrEqual(RESPONSE_TIME_THRESHOLD_MS);
  });

  test('Authenticated GET /orders responds within threshold', async () => {
    const start   = Date.now();
    const res     = await authenticatedAgent.get('/orders');
    const elapsed = Date.now() - start;
    expect([200, 302]).toContain(res.statusCode);
    expect(elapsed).toBeLessThanOrEqual(RESPONSE_TIME_THRESHOLD_MS);
  });

  test('Authenticated GET /user/wishlist responds within threshold', async () => {
    const start   = Date.now();
    const res     = await authenticatedAgent.get('/user/wishlist');
    const elapsed = Date.now() - start;
    expect([200, 302]).toContain(res.statusCode);
    expect(elapsed).toBeLessThanOrEqual(RESPONSE_TIME_THRESHOLD_MS);
  });
});
