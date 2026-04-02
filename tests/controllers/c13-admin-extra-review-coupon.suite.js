const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Admin Routes Additional Coverage', () => {
    test('Admin review and coupon moderation endpoints are covered', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');
      const tempReviewId = db.prepare(`
        INSERT INTO reviews (product_id, user_id, order_id, rating, title, comment, is_approved)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(ids.outOfStockId, ids.cust2Id, ids.orderId, 4, 'Temp review', 'Temp review body').lastInsertRowid;

      const reviewStatus = await agent
        .post(`/admin/reviews/${tempReviewId}/status`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ status: 'visible' });
      expect(reviewStatus.statusCode).toBe(200);
      expect(reviewStatus.body.success).toBe(true);
      expect(db.prepare('SELECT is_approved FROM reviews WHERE id = ?').get(tempReviewId).is_approved).toBe(1);

      const approveReview = await agent
        .post(`/admin/reviews/${tempReviewId}/approve`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(approveReview.statusCode).toBe(200);
      expect(approveReview.body.success).toBe(true);

      const deleteReview = await agent
        .post(`/admin/reviews/${tempReviewId}/delete`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(deleteReview.statusCode).toBe(200);
      expect(deleteReview.body.success).toBe(true);
      expect(db.prepare('SELECT id FROM reviews WHERE id = ?').get(tempReviewId)).toBeUndefined();

      const invalidReview = await agent.post('/admin/reviews/0/approve');
      expect(invalidReview.statusCode).toBe(302);
      expect(invalidReview.headers.location).toContain('/admin/reviews');

      const couponCode = makeUnique('coupon').toUpperCase();
      const createCoupon = await agent
        .post('/admin/coupons')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          code: couponCode,
          description: 'Temp coupon',
          discount_type: 'percent',
          discount_value: 10,
          min_purchase: 20,
          usage_limit: 3
        });
      expect(createCoupon.statusCode).toBe(200);
      expect(createCoupon.body.success).toBe(true);

      const coupon = db.prepare('SELECT id FROM coupons WHERE code = ?').get(couponCode);
      expect(coupon).toBeTruthy();

      const toggleCoupon = await agent
        .post(`/admin/coupons/${coupon.id}/toggle`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(toggleCoupon.statusCode).toBe(200);
      expect(toggleCoupon.body.success).toBe(true);

      const deleteCoupon = await agent
        .post(`/admin/coupons/${coupon.id}/delete`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(deleteCoupon.statusCode).toBe(200);
      expect(deleteCoupon.body.success).toBe(true);
      expect(db.prepare('SELECT id FROM coupons WHERE id = ?').get(coupon.id)).toBeUndefined();
    });

  });
};
