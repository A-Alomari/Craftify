const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });

  describe('Admin Controller Catch and Invalid-ID Coverage', () => {
    test('Admin mutation non-xhr catch paths and optional coupon branches are covered', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');
      const Category = require('../../models/Category');
      const Coupon = require('../../models/Coupon');

      const nonXhrCategorySpy = jest.spyOn(Category, 'create').mockImplementation(() => {
        throw new Error('Forced createCategory non-xhr catch');
      });
      const nonXhrCategory = await agent.post('/admin/categories').send({
        name: `Catch Category ${makeUnique('admin')}`,
        description: 'force non-xhr catch'
      });
      expect(nonXhrCategory.statusCode).toBe(302);
      expect(nonXhrCategory.headers.location).toContain('/admin/categories');
      nonXhrCategorySpy.mockRestore();

      const nonXhrCouponSpy = jest.spyOn(Coupon, 'create').mockImplementation(() => {
        throw new Error('Forced createCoupon non-xhr catch');
      });
      const nonXhrCoupon = await agent.post('/admin/coupons').send({
        code: makeUnique('nonxhr_coupon').toUpperCase(),
        description: 'force non-xhr catch',
        discount_type: 'percent',
        discount_value: '7'
      });
      expect(nonXhrCoupon.statusCode).toBe(302);
      expect(nonXhrCoupon.headers.location).toContain('/admin/coupons');
      nonXhrCouponSpy.mockRestore();

      const optionalCouponCode = makeUnique('optional_coupon').toUpperCase();
      const optionalCoupon = await agent.post('/admin/coupons').send({
        code: optionalCouponCode,
        description: 'Optional branch coverage',
        discount_type: 'percent',
        discount_value: '5',
        min_purchase: '',
        max_discount: '',
        valid_from: '',
        valid_until: '',
        usage_limit: ''
      });
      expect(optionalCoupon.statusCode).toBe(302);
      expect(optionalCoupon.headers.location).toContain('/admin/coupons');

      const createdOptional = db.prepare('SELECT id, min_purchase, max_discount, usage_limit FROM coupons WHERE code = ?').get(optionalCouponCode);
      expect(createdOptional).toBeTruthy();
      expect(createdOptional.min_purchase).toBe(0);
      expect(createdOptional.max_discount).toBeNull();
      expect(createdOptional.usage_limit).toBeNull();
      db.prepare('DELETE FROM coupons WHERE id = ?').run(createdOptional.id);
    });
  });
};
