const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Admin Controller Non-XHR Coverage', () => {
    test('Admin category and coupon non-XHR flows plus invalid id redirects are covered', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');

      const categoryName = `Admin Category ${makeUnique('admin')}`;
      const createCategory = await agent.post('/admin/categories').send({
        name: categoryName,
        description: 'Admin category description'
      });
      expect(createCategory.statusCode).toBe(302);
      expect(createCategory.headers.location).toContain('/admin/categories');

      const category = db.prepare('SELECT id FROM categories WHERE name = ?').get(categoryName);
      expect(category).toBeTruthy();

      const updateCategory = await agent.post(`/admin/categories/${category.id}`).send({
        name: `${categoryName} Updated`,
        description: 'Updated description'
      });
      expect(updateCategory.statusCode).toBe(302);
      expect(updateCategory.headers.location).toContain('/admin/categories');

      const deleteCategory = await agent.post(`/admin/categories/${category.id}/delete`);
      expect(deleteCategory.statusCode).toBe(302);
      expect(deleteCategory.headers.location).toContain('/admin/categories');

      const couponCode = makeUnique('admin_coupon').toUpperCase();
      const createCoupon = await agent.post('/admin/coupons').send({
        code: couponCode,
        description: 'Admin coupon',
        discount_type: 'percent',
        discount_value: 12,
        min_purchase: 10,
        usage_limit: 3
      });
      expect(createCoupon.statusCode).toBe(302);
      expect(createCoupon.headers.location).toContain('/admin/coupons');

      const coupon = db.prepare('SELECT id FROM coupons WHERE code = ?').get(couponCode);
      expect(coupon).toBeTruthy();

      const toggleCoupon = await agent.post(`/admin/coupons/${coupon.id}/toggle`);
      expect(toggleCoupon.statusCode).toBe(302);
      expect(toggleCoupon.headers.location).toContain('/admin/coupons');

      const deleteCoupon = await agent.post(`/admin/coupons/${coupon.id}/delete`);
      expect(deleteCoupon.statusCode).toBe(302);
      expect(deleteCoupon.headers.location).toContain('/admin/coupons');

      const invalidApproveArtisan = await agent.post('/admin/artisans/0/approve');
      expect(invalidApproveArtisan.statusCode).toBe(302);
      expect(invalidApproveArtisan.headers.location).toContain('/admin/artisans');

      const invalidApproveProduct = await agent.post('/admin/products/0/approve');
      expect(invalidApproveProduct.statusCode).toBe(302);
      expect(invalidApproveProduct.headers.location).toContain('/admin/products');

      const invalidUpdateOrder = await agent.post('/admin/orders/0/status').send({ status: 'processing' });
      expect(invalidUpdateOrder.statusCode).toBe(302);
      expect(invalidUpdateOrder.headers.location).toContain('/admin/orders');

      const invalidReview = await agent.post('/admin/reviews/0/status').send({ status: 'hidden' });
      expect(invalidReview.statusCode).toBe(302);
      expect(invalidReview.headers.location).toContain('/admin/reviews');

      const invalidCoupon = await agent.post('/admin/coupons/0/toggle');
      expect(invalidCoupon.statusCode).toBe(302);
      expect(invalidCoupon.headers.location).toContain('/admin/coupons');
    });
  });
};
