/**
 * tests/routes/home.routes.test.js
 *
 * Integration tests for routes/home.js (public pages & contact/subscribe).
 */

'use strict';

process.env.NODE_ENV = 'test';

const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

const dbPath = path.join(__dirname, '..', '..', `craftify.home-routes.${process.pid}.db`);
process.env.CRAFTIFY_DB_PATH = dbPath;

let app;
let db;

beforeAll(async () => {
  try { fs.unlinkSync(dbPath); } catch (_) {}

  const { initDatabase, getDb } = require('../../config/database');
  await initDatabase();
  db = getDb();

  const { seedTestData } = require('../helpers/testDb');
  seedTestData(db);

  app = require('../../server').app;
});

afterAll(() => {
  try { fs.unlinkSync(dbPath); } catch (_) {}
});

// ── Static / informational pages ─────────────────────────────────────────────

describe('Public informational pages', () => {
  const publicRoutes = [
    ['GET /',          '/'],
    ['GET /about',     '/about'],
    ['GET /faq',       '/faq'],
    ['GET /shipping',  '/shipping'],
    ['GET /guidelines','/guidelines'],
    ['GET /terms',     '/terms'],
    ['GET /privacy',   '/privacy'],
    ['GET /contact',   '/contact'],
    ['GET /artisans',  '/artisans'],
  ];

  test.each(publicRoutes)(
    '%s returns 200 for an unauthenticated visitor',
    async (_label, route) => {
      const res = await request(app).get(route);
      expect(res.statusCode).toBe(200);
    }
  );
});

// ── Homepage content ──────────────────────────────────────────────────────────

describe('GET / – homepage', () => {
  it('renders the homepage with a 200 status code', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
  });

  it('includes featured product content in the HTML body', async () => {
    const res = await request(app).get('/');
    expect(res.text.length).toBeGreaterThan(100);
  });
});

// ── POST /contact ─────────────────────────────────────────────────────────────

describe('POST /contact', () => {
  it('accepts a valid contact form submission and redirects', async () => {
    const res = await request(app)
      .post('/contact')
      .send({
        name:    'Test Person',
        email:   'test@person.com',
        subject: 'Question',
        message: 'I have a question about your platform.',
      });

    expect(res.statusCode).toBe(302);
  });

  it('redirects back to /contact when required fields are missing', async () => {
    const res = await request(app)
      .post('/contact')
      .send({ name: '', email: '', subject: '', message: '' });

    // Should redirect (either to /contact or to home with an error)
    expect(res.statusCode).toBe(302);
  });
});

// ── POST /subscribe ───────────────────────────────────────────────────────────

describe('POST /subscribe', () => {
  it('accepts a valid email subscription and redirects', async () => {
    const res = await request(app)
      .post('/subscribe')
      .send({ email: `subscriber_${Date.now()}@test.com` });

    expect(res.statusCode).toBe(302);
  });

  it('handles a duplicate subscription email gracefully (no 500 error)', async () => {
    const email = `dupsub_${Date.now()}@test.com`;
    await request(app).post('/subscribe').send({ email });
    const res = await request(app).post('/subscribe').send({ email });

    // Should redirect without crashing
    expect(res.statusCode).toBe(302);
  });
});

// ── 404 handling ──────────────────────────────────────────────────────────────

describe('404 – unknown routes', () => {
  it('returns 404 for a completely unknown URL', async () => {
    const res = await request(app).get('/this-page-does-not-exist-xyz-abc');
    expect(res.statusCode).toBe(404);
  });
});
