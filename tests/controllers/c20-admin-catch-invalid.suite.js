const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });

  describe('Admin Controller Catch and Invalid-ID Coverage', () => {
    test('Admin non-XHR invalid-id and self-delete branches redirect safely', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');

      const invalidCases = [
        { path: '/admin/users/0/status', body: { status: 'active' }, redirect: '/admin/users' },
        { path: '/admin/users/0/delete', redirect: '/admin/users' },
        { path: '/admin/artisans/0/approve', redirect: '/admin/artisans' },
        { path: '/admin/artisans/0/reject', redirect: '/admin/artisans' },
        { path: '/admin/products/0/approve', redirect: '/admin/products' },
        { path: '/admin/products/0/reject', redirect: '/admin/products' },
        { path: '/admin/products/0/featured', redirect: '/admin/products' },
        { path: '/admin/categories/0', body: { name: 'Bad', description: 'Bad' }, redirect: '/admin/categories' },
        { path: '/admin/categories/0/delete', redirect: '/admin/categories' },
        { path: '/admin/orders/0/status', body: { status: 'processing' }, redirect: '/admin/orders' },
        { path: '/admin/auctions/0/cancel', redirect: '/admin/auctions' },
        { path: '/admin/reviews/0/status', body: { status: 'hidden' }, redirect: '/admin/reviews' },
        { path: '/admin/reviews/0/approve', redirect: '/admin/reviews' },
        { path: '/admin/reviews/0/delete', redirect: '/admin/reviews' },
        { path: '/admin/coupons/0/toggle', redirect: '/admin/coupons' },
        { path: '/admin/coupons/0/delete', redirect: '/admin/coupons' }
      ];

      for (const c of invalidCases) {
        let req = agent.post(c.path);
        if (c.body) {
          req = req.send(c.body);
        }
        const res = await req;
        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toContain(c.redirect);
      }

      const selfDelete = await agent.post(`/admin/users/${ids.adminId}/delete`);
      expect(selfDelete.statusCode).toBe(302);
      expect(selfDelete.headers.location).toContain('/admin/users');
    });

  });
};
