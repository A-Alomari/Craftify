const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Role Protection', () => {
    test('Guest cannot access /orders', async () => {
      const res = await request(app).get('/orders');
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('login');
    });

    test('Guest cannot access /admin/dashboard', async () => {
      const res = await request(app).get('/admin/dashboard');
      expect(res.statusCode).toBe(302);
    });

    test('Guest cannot access /artisan/dashboard', async () => {
      const res = await request(app).get('/artisan/dashboard');
      expect(res.statusCode).toBe(302);
    });

    test('Customer cannot access /admin/dashboard', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/admin/dashboard');
      expect([302, 403]).toContain(res.statusCode);
    });

    test('Customer cannot access /artisan/dashboard', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/artisan/dashboard');
      expect([302, 403]).toContain(res.statusCode);
    });

    test('Artisan cannot access /admin/dashboard', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');
      const res = await agent.get('/admin/dashboard');
      expect([302, 403]).toContain(res.statusCode);
    });
  });

  // ── Artisan Routes ──
};

