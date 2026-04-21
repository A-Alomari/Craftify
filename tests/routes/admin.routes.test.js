/**
 * tests/routes/admin.routes.test.js
 *
 * Integration tests for routes/admin.js.
 * All routes require: isAuthenticated + isActive + isAdmin.
 * Tests confirm that non-admin roles are rejected and admin operations work.
 */

'use strict';

process.env.NODE_ENV = 'test';

const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

const dbPath = path.join(__dirname, '..', '..', `craftify.admin-routes.${process.pid}.db`);
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

describe('Admin routes – unauthenticated access', () => {
  const adminRoutes = [
    '/admin/dashboard',
    '/admin/users',
    '/admin/artisans',
    '/admin/products',
    '/admin/categories',
    '/admin/orders',
    '/admin/auctions',
    '/admin/reviews',
    '/admin/coupons',
    '/admin/reports',
    '/admin/settings',
  ];

  test.each(adminRoutes)(
    'redirects %s to /auth/login for a guest',
    async (route) => {
      const res = await request(app).get(route);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('login');
    }
  );
});

// ── Role-based rejection ──────────────────────────────────────────────────────

describe('Admin routes – customer is rejected', () => {
  it('redirects a customer away from /admin/dashboard', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.get('/admin/dashboard');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});

describe('Admin routes – artisan is rejected', () => {
  it('redirects an artisan away from /admin/dashboard', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'artisan@test.com', password: 'art123' });
    const res = await agent.get('/admin/dashboard');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});

// ── Admin dashboard & listing pages ──────────────────────────────────────────

describe('Admin routes – admin user access', () => {
  let adminAgent;

  beforeEach(async () => {
    adminAgent = request.agent(app);
    await adminAgent.post('/auth/login').send({ email: 'admin@test.com', password: 'admin123' });
  });

  it('returns 200 for GET /admin/dashboard', async () => {
    const res = await adminAgent.get('/admin/dashboard');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /admin/users', async () => {
    const res = await adminAgent.get('/admin/users');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /admin/artisans', async () => {
    const res = await adminAgent.get('/admin/artisans');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /admin/products', async () => {
    const res = await adminAgent.get('/admin/products');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /admin/categories', async () => {
    const res = await adminAgent.get('/admin/categories');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /admin/orders', async () => {
    const res = await adminAgent.get('/admin/orders');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /admin/auctions', async () => {
    const res = await adminAgent.get('/admin/auctions');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /admin/reviews', async () => {
    const res = await adminAgent.get('/admin/reviews');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /admin/coupons', async () => {
    const res = await adminAgent.get('/admin/coupons');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /admin/reports', async () => {
    const res = await adminAgent.get('/admin/reports');
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 for GET /admin/settings', async () => {
    const res = await adminAgent.get('/admin/settings');
    expect(res.statusCode).toBe(200);
  });
});

// ── Artisan moderation ────────────────────────────────────────────────────────

describe('Admin artisan moderation', () => {
  let adminAgent;

  beforeEach(async () => {
    adminAgent = request.agent(app);
    await adminAgent.post('/auth/login').send({ email: 'admin@test.com', password: 'admin123' });
  });

  it('approves an artisan and redirects on POST /admin/artisans/:id/approve', async () => {
    // Create a pending artisan first
    const bcrypt = require('bcryptjs');
    const email = `pending_art_${Date.now()}@test.com`;
    db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)').run(
      'Pending Art', email, bcrypt.hashSync('pass', 4), 'artisan', 'active'
    );
    const user = db.prepare('SELECT id FROM users WHERE email=?').get(email);
    db.prepare('INSERT INTO artisan_profiles (user_id,shop_name,bio,location,is_approved) VALUES (?,?,?,?,0)').run(
      user.id, 'Pending Shop', 'bio', 'Manama'
    );

    const res = await adminAgent.post(`/admin/artisans/${user.id}/approve`);
    expect(res.statusCode).toBe(302);

    const profile = db.prepare('SELECT is_approved FROM artisan_profiles WHERE user_id=?').get(user.id);
    expect(profile.is_approved).toBe(1);
  });

  it('rejects an artisan and redirects on POST /admin/artisans/:id/reject', async () => {
    const bcrypt = require('bcryptjs');
    const email = `reject_art_${Date.now()}@test.com`;
    db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)').run(
      'Reject Art', email, bcrypt.hashSync('pass', 4), 'artisan', 'active'
    );
    const user = db.prepare('SELECT id FROM users WHERE email=?').get(email);
    db.prepare('INSERT INTO artisan_profiles (user_id,shop_name,bio,location,is_approved) VALUES (?,?,?,?,0)').run(
      user.id, 'Reject Shop', 'bio', 'Manama'
    );

    const res = await adminAgent.post(`/admin/artisans/${user.id}/reject`);
    expect(res.statusCode).toBe(302);
  });
});

// ── Product moderation ────────────────────────────────────────────────────────

describe('Admin product moderation', () => {
  let adminAgent;

  beforeEach(async () => {
    adminAgent = request.agent(app);
    await adminAgent.post('/auth/login').send({ email: 'admin@test.com', password: 'admin123' });
  });

  it('approves a pending product on POST /admin/products/:id/approve', async () => {
    const res = await adminAgent.post(`/admin/products/${ids.pendingProdId}/approve`);
    expect(res.statusCode).toBe(302);

    const product = db.prepare('SELECT status FROM products WHERE id=?').get(ids.pendingProdId);
    expect(product.status).toBe('approved');
  });

  it('toggles featured status on POST /admin/products/:id/featured', async () => {
    const before = db.prepare('SELECT featured FROM products WHERE id=?').get(ids.vaseId);
    const res = await adminAgent.post(`/admin/products/${ids.vaseId}/featured`);
    expect(res.statusCode).toBe(302);

    const after = db.prepare('SELECT featured FROM products WHERE id=?').get(ids.vaseId);
    expect(after.featured).not.toBe(before.featured);
  });
});

// ── Category CRUD ─────────────────────────────────────────────────────────────

describe('Admin category management', () => {
  let adminAgent;

  beforeEach(async () => {
    adminAgent = request.agent(app);
    await adminAgent.post('/auth/login').send({ email: 'admin@test.com', password: 'admin123' });
  });

  it('creates a new category on valid POST /admin/categories and redirects', async () => {
    const name = `TestCat_${Date.now()}`;
    const res = await adminAgent
      .post('/admin/categories')
      .field('name',        name)
      .field('description', 'A test category');

    expect(res.statusCode).toBe(302);

    const cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
    expect(cat).toBeDefined();
  });

  it('deletes a category on POST /admin/categories/:id/delete and redirects', async () => {
    const name = `DeleteCat_${Date.now()}`;
    db.prepare(
      'INSERT INTO categories (name,slug,description,image,is_active) VALUES (?,?,?,?,1)'
    ).run(name, `delete-cat-${Date.now()}`, 'Delete me', 'https://example.com/x.jpg');

    const cat = db.prepare('SELECT id FROM categories WHERE name = ?').get(name);
    const res = await adminAgent.post(`/admin/categories/${cat.id}/delete`);
    expect(res.statusCode).toBe(302);

    const gone = db.prepare('SELECT id FROM categories WHERE id = ?').get(cat.id);
    expect(gone).toBeUndefined();
  });
});

// ── User management ───────────────────────────────────────────────────────────

describe('Admin user management', () => {
  let adminAgent;

  beforeEach(async () => {
    adminAgent = request.agent(app);
    await adminAgent.post('/auth/login').send({ email: 'admin@test.com', password: 'admin123' });
  });

  it('suspends a user on POST /admin/users/:id/status with status=suspended', async () => {
    const res = await adminAgent
      .post(`/admin/users/${ids.cust2Id}/status`)
      .send({ status: 'suspended' });

    expect(res.statusCode).toBe(302);

    const user = db.prepare('SELECT status FROM users WHERE id=?').get(ids.cust2Id);
    expect(user.status).toBe('suspended');

    // Restore
    db.prepare("UPDATE users SET status='active' WHERE id=?").run(ids.cust2Id);
  });

  it('deletes a user on POST /admin/users/:id/delete and redirects', async () => {
    const bcrypt = require('bcryptjs');
    const email = `todelete_${Date.now()}@test.com`;
    db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)').run(
      'ToDelete', email, bcrypt.hashSync('pass', 4), 'customer', 'active'
    );
    const user = db.prepare('SELECT id FROM users WHERE email=?').get(email);

    const res = await adminAgent.post(`/admin/users/${user.id}/delete`);
    expect(res.statusCode).toBe(302);

    const gone = db.prepare('SELECT id FROM users WHERE id=?').get(user.id);
    expect(gone).toBeUndefined();
  });
});

// ── Admin coupon management ───────────────────────────────────────────────────

describe('Admin coupon management', () => {
  let adminAgent;

  beforeEach(async () => {
    adminAgent = request.agent(app);
    await adminAgent.post('/auth/login').send({ email: 'admin@test.com', password: 'admin123' });
  });

  it('creates a global coupon on POST /admin/coupons and redirects', async () => {
    const code = `ADMINCOUP${Date.now()}`;
    const now  = new Date();
    const res  = await adminAgent.post('/admin/coupons').send({
      code,
      discount_type:  'fixed',
      discount_value: 5,
      min_purchase:   20,
      valid_until:    new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0],
    });

    expect(res.statusCode).toBe(302);

    const coupon = db.prepare('SELECT * FROM coupons WHERE code=?').get(code);
    expect(coupon).toBeDefined();
  });
});

// ── Review moderation ─────────────────────────────────────────────────────────

describe('Admin review moderation', () => {
  let adminAgent;

  beforeEach(async () => {
    adminAgent = request.agent(app);
    await adminAgent.post('/auth/login').send({ email: 'admin@test.com', password: 'admin123' });
  });

  it('approves a review on POST /admin/reviews/:id/approve', async () => {
    // Create an unapproved review
    db.prepare(
      'INSERT INTO reviews (product_id,user_id,rating,title,comment,is_approved) VALUES (?,?,?,?,?,0)'
    ).run(ids.ringId, ids.cust2Id, 3, 'OK', 'It is fine.');
    const review = db.prepare(
      'SELECT id FROM reviews WHERE product_id=? AND user_id=? ORDER BY id DESC LIMIT 1'
    ).get(ids.ringId, ids.cust2Id);

    const res = await adminAgent.post(`/admin/reviews/${review.id}/approve`);
    expect(res.statusCode).toBe(302);

    const updated = db.prepare('SELECT is_approved FROM reviews WHERE id=?').get(review.id);
    expect(updated.is_approved).toBe(1);
  });

  it('deletes a review on POST /admin/reviews/:id/delete and redirects', async () => {
    db.prepare(
      'INSERT INTO reviews (product_id,user_id,rating,title,comment,is_approved) VALUES (?,?,?,?,?,1)'
    ).run(ids.vaseId, ids.cust2Id, 2, 'Meh', 'Not great.');
    const review = db.prepare(
      'SELECT id FROM reviews WHERE product_id=? AND user_id=? AND title=? ORDER BY id DESC LIMIT 1'
    ).get(ids.vaseId, ids.cust2Id, 'Meh');

    const res = await adminAgent.post(`/admin/reviews/${review.id}/delete`);
    expect(res.statusCode).toBe(302);

    const gone = db.prepare('SELECT id FROM reviews WHERE id=?').get(review.id);
    expect(gone).toBeUndefined();
  });
});
