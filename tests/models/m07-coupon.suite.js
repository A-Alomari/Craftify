module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Coupon Model', () => {
    const Coupon = require('../../models/Coupon');

    test('validate returns valid for correct coupon', () => {
      const result = Coupon.validate('TEST10', 50);
      expect(result.valid).toBe(true);
      expect(result.discount).toBe(5); // 10% of 50
    });

    test('validate rejects invalid coupon code', () => {
      const result = Coupon.validate('FAKECODE', 50);
      expect(result.valid).toBe(false);
    });

    test('validate rejects order below minimum', () => {
      const result = Coupon.validate('TEST10', 10); // min_order is 20
      expect(result.valid).toBe(false);
    });
  });

  // ── Wishlist Model ──
};


