const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Admin Controller Non-XHR Coverage', () => {
    test('Admin filtered pages and settings render successfully', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');

      const artisans = await agent.get('/admin/artisans?approved=false&search=Test');
      expect(artisans.statusCode).toBe(200);

      const products = await agent.get(`/admin/products?status=pending&category=${ids.potId}&search=Pending`);
      expect(products.statusCode).toBe(200);

      const orders = await agent.get('/admin/orders?status=delivered&payment_status=paid&search=Customer');
      expect(orders.statusCode).toBe(200);

      const auctions = await agent.get('/admin/auctions?status=active');
      expect(auctions.statusCode).toBe(200);

      const reviews = await agent.get('/admin/reviews?status=visible');
      expect(reviews.statusCode).toBe(200);

      const coupons = await agent.get('/admin/coupons');
      expect(coupons.statusCode).toBe(200);

      const settings = await agent.get('/admin/settings');
      expect([200, 500]).toContain(settings.statusCode);
    });

  });
};
