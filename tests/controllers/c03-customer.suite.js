const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Customer Routes', () => {
    let agent;

    beforeAll(async () => {
      agent = await loginAs('customer@test.com', 'cust123');
    });

    test('POST /cart/add adds item to cart', async () => {
      const res = await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
      expect(res.statusCode).toBe(302);
    });

    test('POST /cart/update updates quantity', async () => {
      const res = await agent.post('/cart/update').send({ productId: ids.vaseId, quantity: 2 });
      expect(res.statusCode).toBe(302);
    });

    test('POST /cart/remove removes item', async () => {
      const res = await agent.post('/cart/remove').send({ productId: ids.vaseId });
      expect(res.statusCode).toBe(302);
    });

    test('GET /orders returns 200', async () => {
      const res = await agent.get('/orders');
      expect(res.statusCode).toBe(200);
    });

    test('GET /orders/:id returns 200', async () => {
      const oId = db.prepare('SELECT id FROM orders LIMIT 1').get().id;
      const res = await agent.get(`/orders/${oId}`);
      expect(res.statusCode).toBe(200);
    });

    test('GET /user/profile returns 200', async () => {
      const res = await agent.get('/user/profile');
      expect(res.statusCode).toBe(200);
    });

    test('GET /user/wishlist returns 200', async () => {
      const res = await agent.get('/user/wishlist');
      expect(res.statusCode).toBe(200);
    });

    test('GET /user/notifications returns 200', async () => {
      const res = await agent.get('/user/notifications');
      expect(res.statusCode).toBe(200);
    });

    test('POST /auctions/:id/bid with valid bid', async () => {
      const res = await agent.post(`/auctions/${ids.auctionId}/bid`).send({ amount: 65.00 });
      expect([200, 302]).toContain(res.statusCode);
    });
  });

  // ── Role Protection ──
};

