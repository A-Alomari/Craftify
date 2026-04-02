const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Public Pages', () => {
    test('GET / returns 200', async () => {
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(200);
    });

    test('GET /products returns 200', async () => {
      const res = await request(app).get('/products');
      expect(res.statusCode).toBe(200);
    });

    test('GET /products/:id returns 200 for valid product', async () => {
      const res = await request(app).get(`/products/${ids.vaseId}`);
      expect(res.statusCode).toBe(200);
    });

    test('GET /auctions returns 200', async () => {
      const res = await request(app).get('/auctions');
      expect(res.statusCode).toBe(200);
    });

    test('GET /auctions/:id returns 200 for valid auction', async () => {
      const aId = db.prepare('SELECT id FROM auctions WHERE title = ?').get('Test Auction').id;
      const res = await request(app).get(`/auctions/${aId}`);
      expect(res.statusCode).toBe(200);
    });

    test('GET /cart returns 200', async () => {
      const res = await request(app).get('/cart');
      expect(res.statusCode).toBe(200);
    });

    test('GET /auth/login returns 200', async () => {
      const res = await request(app).get('/auth/login');
      expect(res.statusCode).toBe(200);
    });

    test('GET /auth/register returns 200', async () => {
      const res = await request(app).get('/auth/register');
      expect(res.statusCode).toBe(200);
    });

    test('GET /about returns 200', async () => {
      const res = await request(app).get('/about');
      expect(res.statusCode).toBe(200);
    });

    test('GET /faq returns 200', async () => {
      const res = await request(app).get('/faq');
      expect(res.statusCode).toBe(200);
    });

    test('GET /nonexistent returns 404', async () => {
      const res = await request(app).get('/nonexistent-page');
      expect(res.statusCode).toBe(404);
    });
  });

  // ── Auth Routes ──
};

