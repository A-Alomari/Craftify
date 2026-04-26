module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Wishlist Model', () => {
    const Wishlist = require('../../models/Wishlist');

    test('isInWishlist returns true for existing item', () => {
      const result = Wishlist.isInWishlist(ids.custId, ids.ringId);
      expect(result).toBe(true);
    });

    test('isInWishlist returns false for non-existing item', () => {
      const result = Wishlist.isInWishlist(ids.custId, ids.outOfStockId);
      expect(result).toBe(false);
    });

    test('add and remove from wishlist', () => {
      Wishlist.add(ids.custId, ids.vaseId);
      expect(Wishlist.isInWishlist(ids.custId, ids.vaseId)).toBe(true);
      Wishlist.remove(ids.custId, ids.vaseId);
      expect(Wishlist.isInWishlist(ids.custId, ids.vaseId)).toBe(false);
    });

    test('toggle, count, clear and moveToCart helpers work', () => {
      Wishlist.clear(ids.cust2Id);
      expect(Wishlist.count(ids.cust2Id)).toBe(0);

      const toggledOn = Wishlist.toggle(ids.cust2Id, ids.vaseId);
      expect(toggledOn).toBe(true);
      expect(Wishlist.isInWishlist(ids.cust2Id, ids.vaseId)).toBe(true);
      expect(Wishlist.count(ids.cust2Id)).toBe(1);

      const toggledOff = Wishlist.toggle(ids.cust2Id, ids.vaseId);
      expect(toggledOff).toBe(false);
      expect(Wishlist.isInWishlist(ids.cust2Id, ids.vaseId)).toBe(false);

      Wishlist.add(ids.cust2Id, ids.ringId);
      const moved = Wishlist.moveToCart(ids.cust2Id, ids.ringId);
      expect(moved).toBe(true);
      expect(Wishlist.isInWishlist(ids.cust2Id, ids.ringId)).toBe(false);

      const cartItem = db.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?').get(ids.cust2Id, ids.ringId);
      expect(cartItem).toBeTruthy();

      Wishlist.clear(ids.cust2Id);
      expect(Wishlist.count(ids.cust2Id)).toBe(0);
    });
  });

  // ── Notification Model ──
};


