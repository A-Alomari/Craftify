const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });

  describe('Admin Controller Catch and Invalid-ID Coverage', () => {
    test('Admin mutation xhr catch paths return safe responses', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');
      const User = require('../../models/User');
      const ArtisanProfile = require('../../models/ArtisanProfile');
      const Product = require('../../models/Product');
      const Category = require('../../models/Category');
      const Order = require('../../models/Order');
      const Auction = require('../../models/Auction');
      const Review = require('../../models/Review');
      const Coupon = require('../../models/Coupon');

      const existingReview = db.prepare('SELECT id FROM reviews LIMIT 1').get();
      const existingCoupon = db.prepare('SELECT id FROM coupons WHERE code = ?').get('TEST10');
      expect(existingReview).toBeTruthy();
      expect(existingCoupon).toBeTruthy();

      const xhrCases = [
        {
          target: User,
          method: 'updateStatus',
          path: `/admin/users/${ids.cust2Id}/status`,
          body: { status: 'active' }
        },
        {
          target: User,
          method: 'delete',
          path: `/admin/users/${ids.cust2Id}/delete`
        },
        {
          target: ArtisanProfile,
          method: 'approve',
          path: `/admin/artisans/${ids.artId}/approve`
        },
        {
          target: ArtisanProfile,
          method: 'reject',
          path: `/admin/artisans/${ids.artId}/reject`
        },
        {
          target: Product,
          method: 'findById',
          path: `/admin/products/${ids.vaseId}/approve`
        },
        {
          target: Product,
          method: 'findById',
          path: `/admin/products/${ids.vaseId}/reject`
        },
        {
          target: Product,
          method: 'findById',
          path: `/admin/products/${ids.vaseId}/featured`
        },
        {
          target: Category,
          method: 'create',
          path: '/admin/categories',
          body: { name: `Bad Cat ${makeUnique('admin')}`, description: 'bad create' }
        },
        {
          target: Category,
          method: 'update',
          path: `/admin/categories/${ids.potId}`,
          body: { name: 'Bad Update', description: 'bad update' }
        },
        {
          target: Category,
          method: 'delete',
          path: `/admin/categories/${ids.potId}/delete`
        },
        {
          target: Order,
          method: 'updateStatus',
          path: `/admin/orders/${ids.orderId}/status`,
          body: { status: 'processing' }
        },
        {
          target: Auction,
          method: 'cancel',
          path: `/admin/auctions/${ids.auctionId}/cancel`
        },
        {
          target: Review,
          method: 'updateStatus',
          path: `/admin/reviews/${existingReview.id}/status`,
          body: { status: 'hidden' }
        },
        {
          target: Review,
          method: 'updateStatus',
          path: `/admin/reviews/${existingReview.id}/approve`
        },
        {
          target: Review,
          method: 'delete',
          path: `/admin/reviews/${existingReview.id}/delete`
        },
        {
          target: Coupon,
          method: 'create',
          path: '/admin/coupons',
          body: {
            code: makeUnique('xhr_coupon').toUpperCase(),
            description: 'xhr coupon',
            discount_type: 'percent',
            discount_value: 10
          }
        },
        {
          target: Coupon,
          method: 'toggleActive',
          path: `/admin/coupons/${existingCoupon.id}/toggle`
        },
        {
          target: Coupon,
          method: 'delete',
          path: `/admin/coupons/${existingCoupon.id}/delete`
        }
      ];

      for (const c of xhrCases) {
        const spy = jest.spyOn(c.target, c.method).mockImplementation(() => {
          throw new Error(`Forced ${c.method} catch`);
        });

        let req = agent.post(c.path).set('X-Requested-With', 'XMLHttpRequest');
        if (c.body) {
          req = req.send(c.body);
        }
        const res = await req;
        expect(res.statusCode).toBe(500);
        expect(res.body.success).toBe(false);

        spy.mockRestore();
      }
    });
  });
};
