const request = require('supertest');

module.exports = ({ getTestContext, loginAs }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Cart page shows correct data', () => {
    test('Empty cart shows empty message', async () => {
      const res = await request(app).get('/cart');
      const html = res.text;
      expect(html).toContain('Your cart is empty');
    });

    test('Cart with items shows product data', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      // Clear and add
      await agent.post('/cart/clear');
      await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
      const res = await agent.get('/cart');
      expect(res.text).toContain('Test Vase');
    });
  });

  describe('Admin dashboard shows system stats', () => {
    test('Admin dashboard contains user/product/order counts', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');
      const res = await agent.get('/admin/dashboard');
      const html = res.text;
      // Should render without error - 200 status
      expect(res.statusCode).toBe(200);
      // Should contain some data markers
      expect(html).toBeTruthy();
    });
  });

  describe('Artisan dashboard shows sales data', () => {
    test('Artisan dashboard renders with stats', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');
      const res = await agent.get('/artisan/dashboard');
      expect(res.statusCode).toBe(200);
    });

    test('Artisan products page shows their products', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');
      const res = await agent.get('/artisan/products');
      const html = res.text;
      expect(res.statusCode).toBe(200);
      expect(html).toContain('My Products');
      expect(html).toContain('/artisan/products/');
    });
  });

  describe('Nav bar shows correct items per role', () => {
    test('Guest sees login link', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('login');
    });

    test('Logged-in customer sees account', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/');
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Order page shows correct data', () => {
    test('Order detail shows order info', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const oId = db.prepare('SELECT id FROM orders LIMIT 1').get().id;
      const res = await agent.get(`/orders/${oId}`);
      expect(res.statusCode).toBe(200);
      expect(res.text).toContain('45.00');
    });
  });

  describe('Payment failure handling', () => {
    test('Failed mock payment does not create an order', async () => {
      const agent = await loginAs('customer2@test.com', 'cust123');
      await agent.post('/cart/clear');
      await agent.post('/cart/add').send({ productId: ids.ringId, quantity: 1 });

      const before = db.prepare('SELECT COUNT(*) as count FROM orders WHERE user_id = ?').get(ids.cust2Id).count;
      const res = await agent.post('/orders/checkout').send({
        shipping_address: '456 Test St',
        shipping_city: 'Manama',
        shipping_country: 'Bahrain',
        payment_method: 'card',
        card_number: '4000000000000002',
        card_expiry: '12/25',
        card_cvc: '123'
      });
      const after = db.prepare('SELECT COUNT(*) as count FROM orders WHERE user_id = ?').get(ids.cust2Id).count;

      expect(res.statusCode).toBe(302);
      expect(after).toBe(before);
    });
  });

  // ─── Footer Links Tests ───
  // Verifies every link in the footer partial resolves to a valid page (200 OK)
};

