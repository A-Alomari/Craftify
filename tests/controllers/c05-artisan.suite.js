const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Artisan Routes', () => {
    let agent;

    beforeAll(async () => {
      agent = await loginAs('artisan@test.com', 'art123');
    });

    test('GET /artisan/dashboard returns 200', async () => {
      const res = await agent.get('/artisan/dashboard');
      expect(res.statusCode).toBe(200);
    });

    test('GET /artisan/products returns 200', async () => {
      const res = await agent.get('/artisan/products');
      expect(res.statusCode).toBe(200);
    });

    test('GET /artisan/products/new returns 200', async () => {
      const res = await agent.get('/artisan/products/new');
      expect(res.statusCode).toBe(200);
    });

    test('GET /artisan/orders returns 200', async () => {
      const res = await agent.get('/artisan/orders');
      expect(res.statusCode).toBe(200);
    });

    test('GET /artisan/auctions returns 200', async () => {
      const res = await agent.get('/artisan/auctions');
      expect(res.statusCode).toBe(200);
    });

    test('POST /artisan/products creates product', async () => {
      const res = await agent.post('/artisan/products').send({
        name: 'New Artisan Product',
        description: 'A product created via test',
        price: 99.00,
        stock: 5,
        category_id: ids.potId
      });
      expect([200, 302]).toContain(res.statusCode);
    });
  });

  // ── Admin Routes ──
};

