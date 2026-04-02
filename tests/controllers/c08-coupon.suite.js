const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Coupon Routes', () => {
    test('POST /cart/coupon with valid code', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
      const res = await agent.post('/cart/coupon').send({ code: 'TEST10' });
      expect(res.statusCode).toBe(302);
    });

    test('POST /cart/coupon with invalid code', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.post('/cart/coupon').send({ code: 'INVALID' });
      expect(res.statusCode).toBe(302);
    });
  });

  // ── API Routes ──
};

