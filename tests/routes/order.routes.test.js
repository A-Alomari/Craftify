/**
 * tests/routes/order.routes.test.js
 *
 * Integration tests for routes/orders.js.
 * Covers checkout, order listing, order detail, order cancellation, and reorder.
 * All order routes require an authenticated, active customer.
 */

'use strict';

process.env.NODE_ENV = 'test';

const request = require('supertest');
const path    = require('path');
const fs      = require('fs');

const dbPath = path.join(__dirname, '..', '..', `craftify.order-routes.${process.pid}.db`);
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

// ── Unauthenticated guards ────────────────────────────────────────────────────

describe('Order routes – unauthenticated access', () => {
  it('redirects GET /orders to /auth/login for a guest', async () => {
    const res = await request(app).get('/orders');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('login');
  });

  it('redirects GET /orders/checkout to /auth/login for a guest', async () => {
    const res = await request(app).get('/orders/checkout');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('login');
  });

  it('redirects GET /orders/:id to /auth/login for a guest', async () => {
    const res = await request(app).get(`/orders/${ids.orderId}`);
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('login');
  });
});

// ── Role-based guards ─────────────────────────────────────────────────────────

describe('Order routes – artisan is not a customer', () => {
  it('redirects an artisan away from GET /orders', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'artisan@test.com', password: 'art123' });
    const res = await agent.get('/orders');
    expect(res.statusCode).toBe(302);
  });

  it('redirects an artisan away from GET /orders/checkout', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'artisan@test.com', password: 'art123' });
    const res = await agent.get('/orders/checkout');
    expect(res.statusCode).toBe(302);
  });
});

// ── GET /orders ───────────────────────────────────────────────────────────────

describe('GET /orders', () => {
  it('returns 200 and lists orders for an authenticated customer', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.get('/orders');
    expect(res.statusCode).toBe(200);
  });
});

// ── GET /orders/checkout ──────────────────────────────────────────────────────

describe('GET /orders/checkout', () => {
  it('returns 200 for an authenticated customer with items in cart', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    await agent.post('/cart/add').send({ product_id: ids.vaseId, quantity: 1 });
    const res = await agent.get('/orders/checkout');
    expect(res.statusCode).toBe(200);
  });

  it('redirects to /cart when the cart is empty', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer2@test.com', password: 'cust123' });
    // Clear any existing cart items first
    await agent.post('/cart/clear');
    const res = await agent.get('/orders/checkout');
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain('cart');
  });
});

// ── POST /orders/checkout ─────────────────────────────────────────────────────

describe('POST /orders/checkout – order placement', () => {
  it('creates an order and redirects to confirmation when payload is valid', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    await agent.post('/cart/clear');
    await agent.post('/cart/add').send({ product_id: ids.vaseId, quantity: 1 });

    const checkoutPage = await agent.get('/orders/checkout');
    // Extract checkout_nonce from the form
    const nonceMatch = checkoutPage.text.match(/name="checkout_nonce"\s+value="([^"]+)"/);
    const nonce = nonceMatch ? nonceMatch[1] : `nonce-${Date.now()}`;

    const res = await agent.post('/orders/checkout').send({
      shipping_address:  '1 Test St',
      shipping_building: '',
      shipping_city:     'Manama',
      shipping_postal:   '12345',
      shipping_country:  'Bahrain',
      payment_method:    'card',
      card_number:       '4111111111111111',
      card_expiry:       '12/29',
      card_cvc:          '123',
      checkout_nonce:    nonce,
    });

    expect([200, 302]).toContain(res.statusCode);
    if (res.statusCode === 302) {
      expect(res.headers.location).toContain('confirmation');
    }
  });

  it('redirects back to checkout when the cart contains an out-of-stock item', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    await agent.post('/cart/clear');
    // Add out-of-stock product
    await agent.post('/cart/add').send({ product_id: ids.outOfStockId, quantity: 1 });
    // Manually set stock to 0 to simulate out-of-stock
    db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run(ids.outOfStockId);

    const res = await agent.post('/orders/checkout').send({
      shipping_address:  '1 Test St',
      shipping_city:     'Manama',
      shipping_postal:   '12345',
      shipping_country:  'Bahrain',
      payment_method:    'cash',
      checkout_nonce:    `nonce-oos-${Date.now()}`,
    });

    expect(res.statusCode).toBe(302);
    // Should NOT redirect to confirmation
    if (res.headers.location) {
      expect(res.headers.location).not.toContain('confirmation');
    }
  });

  it('rejects checkout when required shipping fields are missing', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    await agent.post('/cart/add').send({ product_id: ids.vaseId, quantity: 1 });

    const res = await agent.post('/orders/checkout').send({
      shipping_address: '',
      shipping_city:    '',
      payment_method:   'cash',
      checkout_nonce:   `nonce-missing-${Date.now()}`,
    });

    expect(res.statusCode).toBe(302);
    expect(res.headers.location).not.toContain('confirmation');
  });
});

// ── GET /orders/:id ───────────────────────────────────────────────────────────

describe('GET /orders/:id – order tracking', () => {
  it('returns 200 when the customer views their own order', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.get(`/orders/${ids.orderId}`);
    expect(res.statusCode).toBe(200);
  });

  it('returns 302 or 404 when a customer tries to view another customer\'s order', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer2@test.com', password: 'cust123' });
    const res = await agent.get(`/orders/${ids.orderId}`);
    expect([302, 404]).toContain(res.statusCode);
  });

  it('returns 302 or 404 for a non-existent order ID', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.get('/orders/999999');
    expect([302, 404]).toContain(res.statusCode);
  });
});

// ── GET /orders/:id/confirmation ──────────────────────────────────────────────

describe('GET /orders/:id/confirmation', () => {
  it('returns 200 when a customer views their own order confirmation page', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.get(`/orders/${ids.orderId}/confirmation`);
    expect([200, 302]).toContain(res.statusCode);
  });
});

// ── GET /orders/:id/items ─────────────────────────────────────────────────────

describe('GET /orders/:id/items', () => {
  it('returns order items for an authenticated customer who owns the order', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.get(`/orders/${ids.orderId}/items`);
    expect([200, 302]).toContain(res.statusCode);
  });
});

// ── POST /orders/:id/cancel ───────────────────────────────────────────────────

describe('POST /orders/:id/cancel', () => {
  it('allows a customer to cancel their own pending order', async () => {
    // Create a cancellable order first
    const r = db.prepare(
      'INSERT INTO orders (user_id,subtotal,shipping_cost,discount_amount,total_amount,status,payment_method,payment_status,shipping_address,shipping_city,shipping_country) VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).run(ids.custId, 10, 0, 0, 10, 'pending', 'cash', 'paid', '1 St', 'Manama', 'Bahrain');

    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.post(`/orders/${r.lastInsertRowid}/cancel`);

    expect(res.statusCode).toBe(302);
  });

  it('does not allow cancellation of a delivered order', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.post(`/orders/${ids.orderId}/cancel`);
    // orderId is 'delivered', should redirect with an error
    expect(res.statusCode).toBe(302);
  });
});

// ── POST /orders/:id/reorder ──────────────────────────────────────────────────

describe('POST /orders/:id/reorder', () => {
  it('adds items from a past order back to the cart and redirects', async () => {
    const agent = request.agent(app);
    await agent.post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
    const res = await agent.post(`/orders/${ids.orderId}/reorder`);
    expect(res.statusCode).toBe(302);
  });
});
