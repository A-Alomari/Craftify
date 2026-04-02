const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('API Routes Additional Coverage', () => {
    test('GET /api/cart/count works for guests and authenticated users', async () => {
      const guestRes = await request(app).get('/api/cart/count');
      expect(guestRes.statusCode).toBe(200);
      expect(guestRes.body).toHaveProperty('count');

      const agent = await loginAs('customer@test.com', 'cust123');
      await agent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
      const userRes = await agent.get('/api/cart/count');
      expect(userRes.statusCode).toBe(200);
      expect(userRes.body.count).toBeGreaterThanOrEqual(1);
    });

    test('GET /api/notifications supports guest and user responses', async () => {
      const guestRes = await request(app).get('/api/notifications');
      expect(guestRes.statusCode).toBe(200);
      expect(guestRes.body.count).toBe(0);

      const agent = await loginAs('customer@test.com', 'cust123');
      const userRes = await agent.get('/api/notifications');
      expect(userRes.statusCode).toBe(200);
      expect(userRes.body).toHaveProperty('notifications');
      expect(userRes.body).toHaveProperty('count');
    });

    test('GET /api/wishlist/check/:productId handles guest and user', async () => {
      const guestRes = await request(app).get(`/api/wishlist/check/${ids.ringId}`);
      expect(guestRes.statusCode).toBe(200);
      expect(guestRes.body.inWishlist).toBe(false);

      const agent = await loginAs('customer@test.com', 'cust123');
      await agent.post('/user/wishlist/add').send({ productId: ids.ringId });
      const userRes = await agent.get(`/api/wishlist/check/${ids.ringId}`);
      expect(userRes.statusCode).toBe(200);
      expect(userRes.body.inWishlist).toBe(true);
    });

    test('GET /api/auctions/:id/updates returns both success and not-found branches', async () => {
      const okRes = await request(app).get(`/api/auctions/${ids.auctionId}/updates`);
      expect(okRes.statusCode).toBe(200);
      expect(okRes.body).toHaveProperty('currentBid');

      const notFound = await request(app).get('/api/auctions/999999/updates');
      expect(notFound.statusCode).toBe(404);
    });

    test('POST /api/coupons/validate handles valid and invalid coupon codes', async () => {
      const valid = await request(app).post('/api/coupons/validate').send({ code: 'TEST10', total: 100 });
      expect(valid.statusCode).toBe(200);
      expect(valid.body.valid).toBe(true);

      const invalid = await request(app).post('/api/coupons/validate').send({ code: 'BADCODE', total: 100 });
      expect(invalid.statusCode).toBe(200);
      expect(invalid.body.valid).toBe(false);
    });

    test('GET /api/search/suggestions covers short query, normal path, and catch fallback', async () => {
      const shortQ = await request(app).get('/api/search/suggestions?q=a');
      expect(shortQ.statusCode).toBe(200);
      expect(shortQ.body.suggestions).toEqual([]);

      const normal = await request(app).get('/api/search/suggestions?q=Test');
      expect(normal.statusCode).toBe(200);
      expect(Array.isArray(normal.body.suggestions)).toBe(true);

      const Product = require('../../models/Product');
      const spy = jest.spyOn(Product, 'findAll').mockImplementation(() => { throw new Error('forced'); });
      const fallback = await request(app).get('/api/search/suggestions?q=Test');
      expect(fallback.statusCode).toBe(500);
      expect(fallback.body.suggestions).toEqual([]);
      spy.mockRestore();
    });

    test('API cart catch and auction starting-price fallback branches are covered', async () => {
      const Cart = require('../../models/Cart');
      const Auction = require('../../models/Auction');
      const agent = await loginAs('customer@test.com', 'cust123');

      const guestAgent = request.agent(app);
      await guestAgent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
      const guestCountSpy = jest.spyOn(Cart, 'getCount');
      const guestCount = await guestAgent.get('/api/cart/count');
      expect(guestCount.statusCode).toBe(200);
      expect(guestCountSpy).toHaveBeenCalledWith(null, expect.any(String));
      guestCountSpy.mockRestore();

      const cartSpy = jest.spyOn(Cart, 'getCount').mockImplementation(() => {
        throw new Error('forced cart count error');
      });
      const cartFallback = await agent.get('/api/cart/count');
      expect(cartFallback.statusCode).toBe(500);
      expect(cartFallback.body.count).toBe(0);
      cartSpy.mockRestore();

      const auctionSpy = jest.spyOn(Auction, 'findById').mockReturnValue({
        id: ids.auctionId,
        starting_price: 44,
        current_highest_bid: null,
        winner_id: null,
        bid_count: 0,
        status: 'active'
      });
      const bidsSpy = jest.spyOn(Auction, 'getBids').mockReturnValue([]);

      const updates = await request(app).get(`/api/auctions/${ids.auctionId}/updates`);
      expect(updates.statusCode).toBe(200);
      expect(updates.body.currentBid).toBe(44);

      bidsSpy.mockRestore();
      auctionSpy.mockRestore();
    });
  });
};

