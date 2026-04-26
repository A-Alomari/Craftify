module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Cart Model', () => {
    const Cart = require('../../models/Cart');

    test('addItem adds item to cart', () => {
      Cart.addItem(ids.custId, null, ids.vaseId, 2);
      const items = Cart.getItems(ids.custId, null);
      expect(items.length).toBeGreaterThanOrEqual(1);
    });

    test('getTotal returns correct total', () => {
      const totals = Cart.getTotal(ids.custId, null);
      expect(totals.total).toBeGreaterThan(0);
    });

    test('updateItemQuantity updates quantity', () => {
      Cart.updateItemQuantity(ids.custId, null, ids.vaseId, 3);
      const items = Cart.getItems(ids.custId, null);
      const item = items.find(i => i.product_id === ids.vaseId);
      expect(item.quantity).toBe(3);
    });

    test('removeItem removes item from cart', () => {
      Cart.removeItem(ids.custId, null, ids.vaseId);
      const items = Cart.getItems(ids.custId, null);
      const item = items.find(i => i.product_id === ids.vaseId);
      expect(item).toBeUndefined();
    });

    test('clear empties the cart', () => {
      Cart.addItem(ids.custId, null, ids.vaseId, 1);
      Cart.clear(ids.custId, null);
      const items = Cart.getItems(ids.custId, null);
      expect(items.length).toBe(0);
    });
  });

  // ── Auction Model ──
};


