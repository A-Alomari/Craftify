const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('API Routes', () => {
    test('GET /api/products returns JSON', async () => {
      const res = await request(app).get('/api/products');
      expect(res.statusCode).toBe(200);
      expect(res.body).toBeTruthy();
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

};

