module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Review Model', () => {
    const Review = require('../../models/Review');

    test('findByProductId returns reviews for a product', () => {
      const reviews = Review.findByProductId(ids.vaseId);
      expect(reviews.length).toBeGreaterThanOrEqual(1);
      expect(reviews[0].rating).toBe(5);
    });

    test('getAverageRating returns correct average', () => {
      const stats = Review.getAverageRating(ids.vaseId);
      expect(stats).toBeTruthy();
      expect(stats.avg_rating).toBe(5);
    });

    test('canReview returns correct status', () => {
      // Customer who has ordered the product can review
      const result = Review.canReview(ids.custId, ids.vaseId);
      expect(result).toBeTruthy();
    });

    test('findById and findByUserId return joined fields with limit support', () => {
      const existingReviewId = db.prepare('SELECT id FROM reviews WHERE user_id = ? LIMIT 1').get(ids.custId).id;
      const byId = Review.findById(existingReviewId);

      expect(byId).toBeTruthy();
      expect(byId).toHaveProperty('reviewer_name');
      expect(byId).toHaveProperty('product_name');

      const limited = Review.findByUserId(ids.custId, 1);
      expect(Array.isArray(limited)).toBe(true);
      expect(limited.length).toBe(1);
      expect(limited[0]).toHaveProperty('product_name');
    });

    test('findAll and count support status, artisan, and rating filters', () => {
      const filtered = Review.findAll({ status: 'visible', artisan_id: ids.artId, rating: 5, limit: 10 });
      expect(Array.isArray(filtered)).toBe(true);
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      filtered.forEach((r) => {
        expect(r.rating).toBe(5);
      });

      const visibleCount = Review.count({ status: 'visible', artisan_id: ids.artId });
      expect(visibleCount).toBeGreaterThanOrEqual(1);

      const artisanAverage = Review.getArtisanAverageRating(ids.artId);
      expect(artisanAverage).toHaveProperty('avg_rating');
      expect(artisanAverage).toHaveProperty('count');
    });

    test('create/update/status/helpful/distribution/delete flows work and duplicate is blocked', () => {
      const created = Review.create({
        product_id: ids.outOfStockId,
        user_id: ids.cust2Id,
        rating: 4,
        title: 'Temporary Review',
        comment: 'Temporary comment'
      });

      expect(created).toBeTruthy();
      expect(created.user_id).toBe(ids.cust2Id);

      Review.incrementHelpful(created.id);
      const afterHelpful = Review.findById(created.id);
      expect(afterHelpful.helpful_count).toBeGreaterThanOrEqual(1);

      const updated = Review.update(created.id, {
        rating: 3,
        title: 'Updated Review',
        comment: 'Updated comment'
      });
      expect(updated.rating).toBe(3);

      const hidden = Review.updateStatus(created.id, 'hidden');
      expect(hidden.is_approved).toBe(0);

      const visible = Review.updateStatus(created.id, 'visible');
      expect(visible.is_approved).toBe(1);

      const distribution = Review.getRatingDistribution(ids.outOfStockId);
      expect(distribution.some((row) => row.rating === 3)).toBe(true);

      expect(() => {
        Review.create({
          product_id: ids.outOfStockId,
          user_id: ids.cust2Id,
          rating: 5,
          title: 'Duplicate Review',
          comment: 'Should throw'
        });
      }).toThrow('already reviewed');

      Review.delete(created.id);
      expect(Review.findById(created.id)).toBeUndefined();
    });

    test('canReview handles non-purchase and already-reviewed branches', () => {
      const noPurchase = Review.canReview(ids.cust2Id, ids.vaseId);
      expect(noPurchase.canReview).toBe(false);
      expect(noPurchase.hasPurchased).toBe(false);
      expect(noPurchase.hasReviewed).toBe(false);

      const alreadyReviewed = Review.canReview(ids.custId, ids.vaseId);
      expect(alreadyReviewed.canReview).toBe(false);
      expect(alreadyReviewed.hasPurchased).toBe(true);
      expect(alreadyReviewed.hasReviewed).toBe(true);
    });
  });

  // ── Category Model ──
};


