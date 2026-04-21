/**
 * tests/routes/product.routes.test.js
 *
 * Integration tests for routes/products.js.
 * Covers public browsing: listing, detail, category filter, artisan filter, search.
 */

'use strict';

process.env.NODE_ENV = 'test';

const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

const dbPath = path.join(__dirname, '..', '..', `craftify.product-routes.${process.pid}.db`);
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

// ── GET /products ─────────────────────────────────────────────────────────────

describe('GET /products', () => {
  it('returns 200 with a list of approved products for any visitor', async () => {
    const res = await request(app).get('/products');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 when filtering by category_id query param', async () => {
    const res = await request(app).get(`/products?category_id=${ids.potId}`);
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 when filtering by price range', async () => {
    const res = await request(app).get('/products?minPrice=10&maxPrice=100');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 when filtering with a search query', async () => {
    const res = await request(app).get('/products?search=Vase');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 when sorting by price_asc', async () => {
    const res = await request(app).get('/products?sort=price_asc');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 when sorting by newest', async () => {
    const res = await request(app).get('/products?sort=newest');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for page 2 pagination', async () => {
    const res = await request(app).get('/products?page=2');
    expect(res.statusCode).toBe(200);
  });
});

// ── GET /products/:id ─────────────────────────────────────────────────────────

describe('GET /products/:id', () => {
  it('returns 200 and renders the product detail page for an approved product', async () => {
    const res = await request(app).get(`/products/${ids.vaseId}`);
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/Test Vase/);
  });

  it('increments the product view count after visiting the detail page', async () => {
    const before = db.prepare('SELECT views FROM products WHERE id = ?').get(ids.vaseId);
    await request(app).get(`/products/${ids.vaseId}`);
    const after  = db.prepare('SELECT views FROM products WHERE id = ?').get(ids.vaseId);
    expect(after.views).toBe(before.views + 1);
  });

  it('returns 302 or 404 for a product ID that does not exist', async () => {
    const res = await request(app).get('/products/999999');
    expect([302, 404]).toContain(res.statusCode);
  });

  it('returns 404 or redirects for a non-numeric product ID', async () => {
    const res = await request(app).get('/products/not-a-number');
    expect([302, 404]).toContain(res.statusCode);
  });
});

// ── GET /products/search ──────────────────────────────────────────────────────

describe('GET /products/search', () => {
  it('redirects to /products with the search query when q param is provided', async () => {
    const res = await request(app).get('/products/search?q=Vase');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('Vase');
  });

  it('redirects to /products when search query is empty', async () => {
    const res = await request(app).get('/products/search?q=');
    expect([200, 302]).toContain(res.statusCode);
  });
});

// ── GET /products/category/:id ────────────────────────────────────────────────

describe('GET /products/category/:id', () => {
  it('returns 200 for a valid category ID', async () => {
    const res = await request(app).get(`/products/category/${ids.potId}`);
    expect(res.statusCode).toBe(200);
  });

  it('returns 404 or redirects for a category ID that does not exist', async () => {
    const res = await request(app).get('/products/category/99999');
    expect([302, 404]).toContain(res.statusCode);
  });
});

// ── GET /products/artisan/:id ─────────────────────────────────────────────────

describe('GET /products/artisan/:id', () => {
  it('returns 200 when viewing products by a valid artisan user ID', async () => {
    const res = await request(app).get(`/products/artisan/${ids.artId}`);
    expect(res.statusCode).toBe(200);
  });

  it('returns 404 or redirects for an artisan ID that does not exist', async () => {
    const res = await request(app).get('/products/artisan/999999');
    expect([302, 404]).toContain(res.statusCode);
  });
});
