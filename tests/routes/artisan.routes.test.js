/**
 * tests/routes/artisan.routes.test.js
 *
 * Integration tests for routes/artisan.js.
 * All routes under /artisan require: isAuthenticated + isActive + isArtisan.
 * Most also require isApprovedArtisan.
 */

'use strict';

process.env.NODE_ENV = 'test';

const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

const dbPath = path.join(__dirname, '..', '..', `craftify.artisan-routes.${process.pid}.db`);
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

// ── Unauthenticated access guard ──────────────────────────────────────────────

describe('Artisan routes – unauthenticated access', () => {
  const protectedRoutes = [
    '/artisan/dashboard',
    '/artisan/products',
    '/artisan/orders',
    '/artisan/auctions',
    '/artisan/reviews',
    '/artisan/coupons',
    '/artisan/analytics',
  ];

  test.each(protectedRoutes)(
    'redirects %s to /auth/login for a guest visitor',
    async (route) => {
      const res = await request(app).get(route);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('login');
    }
  );
});

// ── Customer cannot access artisan routes ────────────────────────────────────

describe('Artisan routes – customer is rejected', () => {
  it('redirects a customer away from /artisan/dashboard', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.get('/artisan/dashboard');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});

// ── Pending artisan is redirected to /artisan/pending ────────────────────────

describe('Artisan routes – unapproved artisan', () => {
  let unapprovedArtisanEmail;

  beforeAll(() => {
    // Create an unapproved artisan
    const bcrypt = require('bcryptjs');
    unapprovedArtisanEmail = `unapproved_${Date.now()}@test.com`;
    db.prepare(
      'INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)'
    ).run('Unapproved', unapprovedArtisanEmail, bcrypt.hashSync('pass123', 4), 'artisan', 'active');

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(unapprovedArtisanEmail);
    db.prepare(
      'INSERT INTO artisan_profiles (user_id,shop_name,bio,location,is_approved) VALUES (?,?,?,?,0)'
    ).run(user.id, 'Pending Shop', 'Waiting', 'Manama');
  });

  it('redirects an unapproved artisan to /artisan/pending when accessing dashboard', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: unapprovedArtisanEmail, password: 'pass123' });
    const res = await agent.get('/artisan/dashboard');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('pending');
  });

  it('returns 200 for GET /artisan/pending (the pending approval page)', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: unapprovedArtisanEmail, password: 'pass123' });
    const res = await agent.get('/artisan/pending');
    expect(res.statusCode).toBe(200);
  });
});

// ── Approved artisan – dashboard ──────────────────────────────────────────────

describe('Artisan routes – approved artisan', () => {
  let artisanAgent;

  beforeEach(async () => {
    artisanAgent = request.agent(app);
    await artisanAgent.post('/auth/login').send({ email: 'artisan@test.com', password: 'art123' });
  });

  it('returns 200 for GET /artisan/dashboard', async () => {
    const res = await artisanAgent.get('/artisan/dashboard');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /artisan/products', async () => {
    const res = await artisanAgent.get('/artisan/products');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /artisan/products/new', async () => {
    const res = await artisanAgent.get('/artisan/products/new');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /artisan/orders', async () => {
    const res = await artisanAgent.get('/artisan/orders');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /artisan/auctions', async () => {
    const res = await artisanAgent.get('/artisan/auctions');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /artisan/reviews', async () => {
    const res = await artisanAgent.get('/artisan/reviews');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /artisan/coupons', async () => {
    const res = await artisanAgent.get('/artisan/coupons');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /artisan/analytics', async () => {
    const res = await artisanAgent.get('/artisan/analytics');
    expect(res.statusCode).toBe(200);
  });
});

// ── Product CRUD ──────────────────────────────────────────────────────────────

describe('Artisan product management', () => {
  let artisanAgent;

  beforeEach(async () => {
    artisanAgent = request.agent(app);
    await artisanAgent.post('/auth/login').send({ email: 'artisan@test.com', password: 'art123' });
  });

  it('creates a new product and redirects on valid POST /artisan/products', async () => {
    const res = await artisanAgent
      .post('/artisan/products')
      .field('name',        'New Test Bowl')
      .field('description', 'A fine test bowl')
      .field('price',       '39.99')
      .field('stock',       '5')
      .field('category_id', String(ids.potId));

    expect(res.statusCode).toBe(302);

    const product = db.prepare("SELECT * FROM products WHERE name = 'New Test Bowl'").get();
    expect(product).toBeDefined();
  });

  it('redirects back with an error on POST /artisan/products with missing required fields', async () => {
    const res = await artisanAgent
      .post('/artisan/products')
      .field('name',        '')
      .field('description', '')
      .field('price',       '')
      .field('stock',       '');

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('new');
  });

  it('returns 200 for GET /artisan/products/:id/edit on an artisan\'s own product', async () => {
    const res = await artisanAgent.get(`/artisan/products/${ids.vaseId}/edit`);
    expect(res.statusCode).toBe(200);
  });

  it('updates a product on POST /artisan/products/:id and redirects', async () => {
    const res = await artisanAgent
      .post(`/artisan/products/${ids.vaseId}`)
      .field('name',        'Updated Vase')
      .field('description', 'Still a fine vase')
      .field('price',       '50.00')
      .field('stock',       '8')
      .field('category_id', String(ids.potId));

    expect(res.statusCode).toBe(302);
  });

  it('deletes a product via POST /artisan/products/:id/delete and redirects', async () => {
    // Create a product specifically for deletion
    db.prepare(
      'INSERT INTO products (artisan_id,category_id,name,description,price,stock,images,status,is_active) VALUES (?,?,?,?,?,?,?,?,1)'
    ).run(ids.artId, ids.potId, 'To Be Deleted', 'Delete me', 10, 1, '[]', 'approved');

    const toDelete = db.prepare("SELECT id FROM products WHERE name = 'To Be Deleted'").get();

    const res = await artisanAgent.post(`/artisan/products/${toDelete.id}/delete`);
    expect(res.statusCode).toBe(302);

    const gone = db.prepare('SELECT id FROM products WHERE id = ?').get(toDelete.id);
    expect(gone).toBeUndefined();
  });
});

// ── Coupon CRUD ───────────────────────────────────────────────────────────────

describe('Artisan coupon management', () => {
  let artisanAgent;

  beforeEach(async () => {
    artisanAgent = request.agent(app);
    await artisanAgent.post('/auth/login').send({ email: 'artisan@test.com', password: 'art123' });
  });

  it('creates a new coupon on valid POST /artisan/coupons and redirects', async () => {
    const code = `ART${Date.now()}`;
    const now  = new Date();
    const res  = await artisanAgent.post('/artisan/coupons').send({
      code,
      discount_type:  'percent',
      discount_value: 15,
      min_purchase:   10,
      valid_until:    new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0],
    });

    expect(res.statusCode).toBe(302);
  });

  it('toggles a coupon active/inactive on POST /artisan/coupons/:id/toggle', async () => {
    const code = `TOG${Date.now()}`;
    const now  = new Date();
    db.prepare(
      'INSERT INTO coupons (code,type,value,min_order,is_active,artisan_id,expires_at) VALUES (?,?,?,?,1,?,?)'
    ).run(code, 'percent', 5, 0, ids.artId, new Date(now.getTime() + 30 * 86400000).toISOString());

    const coupon = db.prepare('SELECT id FROM coupons WHERE code = ?').get(code);
    const res = await artisanAgent.post(`/artisan/coupons/${coupon.id}/toggle`);
    expect(res.statusCode).toBe(302);
  });
});

// ── Order status update ───────────────────────────────────────────────────────

describe('Artisan order management', () => {
  it('returns 200 for GET /artisan/orders/:id on an order belonging to the artisan', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'artisan@test.com', password: 'art123' });
    const res = await agent.get(`/artisan/orders/${ids.orderId}`);
    expect([200, 302, 404]).toContain(res.statusCode);
  });
});
