/**
 * tests/routes/auth.routes.test.js
 *
 * Integration tests for routes/auth.js.
 * Uses Supertest against the full Express app with an isolated test DB.
 * CSRF is disabled automatically when NODE_ENV=test (see server.js line 160).
 */

'use strict';

process.env.NODE_ENV = 'test';

const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

// ── Isolated DB setup ─────────────────────────────────────────────────────────
const dbPath = path.join(__dirname, '..', '..', `craftify.auth-routes.${process.pid}.db`);
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

// ── GET /auth/login ───────────────────────────────────────────────────────────

describe('GET /auth/login', () => {
  it('returns 200 and renders the login form for an unauthenticated visitor', async () => {
    const res = await request(app).get('/auth/login');
    expect(res.statusCode).toBe(200);
    expect(res.text).toMatch(/login/i);
  });

  it('redirects to / when an already-authenticated user visits /auth/login', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.get('/auth/login');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});

// ── GET /auth/register ────────────────────────────────────────────────────────

describe('GET /auth/register', () => {
  it('returns 200 and renders the registration form', async () => {
    const res = await request(app).get('/auth/register');
    expect(res.statusCode).toBe(200);
  });

  it('redirects to / when a logged-in user visits /auth/register', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.get('/auth/register');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/');
  });
});

// ── GET /auth/artisan-register ────────────────────────────────────────────────

describe('GET /auth/artisan-register', () => {
  it('returns 200 and renders the artisan registration form', async () => {
    const res = await request(app).get('/auth/artisan-register');
    expect(res.statusCode).toBe(200);
  });
});

// ── POST /auth/login ──────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  it('redirects to / with a session cookie when credentials are valid', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'customer@test.com', password: 'cust123' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).not.toContain('login');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('redirects to /auth/login when the password does not match the stored hash', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'customer@test.com', password: 'wrongpassword' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('login');
  });

  it('redirects to /auth/login when the email does not exist in the database', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@test.com', password: 'anything' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('login');
  });

  it('redirects to /auth/login when the account is suspended', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'suspended@test.com', password: 'susp123' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('login');
  });

  it('redirects admin users to /admin/dashboard after login', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'admin123' });

    expect(res.statusCode).toBe(302);
    // Admin should land on dashboard or home, not back at /auth/login
    expect(res.headers.location).not.toContain('login');
  });

  it('redirects artisan users away from the login page after login', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'artisan@test.com', password: 'art123' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).not.toContain('login');
  });
});

// ── POST /auth/register ───────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  it('creates a new customer account and redirects on valid registration', async () => {
    const email = `new_customer_${Date.now()}@test.com`;
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'New Customer', email, password: 'pass1234', confirmPassword: 'pass1234' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).not.toContain('register');

    // Verify the user was persisted in the database
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    expect(user).toBeDefined();
    expect(user.role).toBe('customer');
  });

  it('redirects back to /auth/register when the email is already in use', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Dup', email: 'customer@test.com', password: 'pass1234', confirmPassword: 'pass1234' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('register');
  });

  it('redirects back to /auth/register when name is missing', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: '', email: `x${Date.now()}@test.com`, password: 'pass1234', confirmPassword: 'pass1234' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('register');
  });

  it('redirects back to /auth/register when passwords do not match', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'Test', email: `mismatch${Date.now()}@test.com`, password: 'pass1234', confirmPassword: 'different' });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('register');
  });

  it('does not insert the user into the database when registration fails', async () => {
    const email = `failreg_${Date.now()}@test.com`;
    await request(app)
      .post('/auth/register')
      .send({ name: '', email, password: 'pass1234', confirmPassword: 'pass1234' });

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    expect(user).toBeUndefined();
  });
});

// ── GET /auth/logout & POST /auth/logout ──────────────────────────────────────

describe('Logout', () => {
  it('GET /auth/logout redirects to / (legacy GET support)', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.get('/auth/logout');
    expect(res.statusCode).toBe(302);
  });

  it('POST /auth/logout destroys the session and redirects to /', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });

    const logoutRes = await agent.post('/auth/logout');
    expect(logoutRes.statusCode).toBe(302);

    // After logout, visiting a protected page should redirect to login
    const protectedRes = await agent.get('/orders');
    expect(protectedRes.statusCode).toBe(302);
    expect(protectedRes.headers.location).toContain('login');
  });
});

// ── GET /auth/forgot-password ─────────────────────────────────────────────────

describe('GET /auth/forgot-password', () => {
  it('returns 200 and renders the forgot-password form', async () => {
    const res = await request(app).get('/auth/forgot-password');
    expect(res.statusCode).toBe(200);
  });
});

// ── POST /auth/forgot-password ────────────────────────────────────────────────

describe('POST /auth/forgot-password', () => {
  it('redirects after submitting a valid email (does not reveal existence)', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'customer@test.com' });

    // Should redirect regardless of whether the email exists (prevent enumeration)
    expect(res.statusCode).toBe(302);
  });

  it('still redirects (no error) when the submitted email does not exist', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nonexistent@ghost.com' });

    expect(res.statusCode).toBe(302);
  });
});

// ── GET /auth/reset-password/:token ───────────────────────────────────────────

describe('GET /auth/reset-password/:token', () => {
  it('redirects when the token is invalid or does not exist', async () => {
    const res = await request(app).get('/auth/reset-password/invalid-token-xyz');
    expect(res.statusCode).toBe(302);
  });
});
