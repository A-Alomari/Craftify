const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Admin Routes', () => {
    let agent;

    beforeAll(async () => {
      agent = await loginAs('admin@test.com', 'admin123');
    });

    test('GET /admin/dashboard returns 200', async () => {
      const res = await agent.get('/admin/dashboard');
      expect(res.statusCode).toBe(200);
    });

    test('GET /admin/users returns 200', async () => {
      const res = await agent.get('/admin/users');
      expect(res.statusCode).toBe(200);
    });

    test('GET /admin/products returns 200', async () => {
      const res = await agent.get('/admin/products');
      expect(res.statusCode).toBe(200);
    });

    test('GET /admin/orders returns 200', async () => {
      const res = await agent.get('/admin/orders');
      expect(res.statusCode).toBe(200);
    });

    test('GET /admin/auctions returns 200', async () => {
      const res = await agent.get('/admin/auctions');
      expect(res.statusCode).toBe(200);
    });

    test('GET /admin/categories returns 200', async () => {
      const res = await agent.get('/admin/categories');
      expect(res.statusCode).toBe(200);
    });

    test('GET /admin/reviews returns 200', async () => {
      const res = await agent.get('/admin/reviews');
      expect(res.statusCode).toBe(200);
    });

    test('GET /admin/reports returns 200', async () => {
      const res = await agent.get('/admin/reports');
      expect(res.statusCode).toBe(200);
    });

    test('POST /admin/users/:id/status suspends user', async () => {
      const res = await agent.post(`/admin/users/${ids.cust2Id}/status`).send({ status: 'suspended' });
      expect([200, 302]).toContain(res.statusCode);
      // Restore
      await agent.post(`/admin/users/${ids.cust2Id}/status`).send({ status: 'active' });
    });
  });

  // ── Cart & Checkout Flow ──
};

