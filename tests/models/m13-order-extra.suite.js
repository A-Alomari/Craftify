module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Order Model (additional methods)', () => {
    const Order = require('../../models/Order');

    test('find/filter/update/revenue/recent methods work', () => {
      const byUser = Order.findByUserId(ids.custId, { status: 'delivered', limit: 5 });
      expect(Array.isArray(byUser)).toBe(true);

      const allFiltered = Order.findAll({
        status: 'delivered',
        payment_status: 'paid',
        search: 'Customer',
        date_from: '2000-01-01',
        date_to: '2999-01-01',
        limit: 10,
        offset: 0
      });
      expect(Array.isArray(allFiltered)).toBe(true);

      const created = Order.create({
        user_id: ids.cust2Id,
        shipping_address: 'Road 100',
        shipping_city: 'Manama',
        shipping_postal: '100',
        shipping_country: 'Bahrain',
        total_amount: 40,
        subtotal: 35,
        shipping_cost: 5,
        discount_amount: 0,
        coupon_code: null,
        payment_method: 'card',
        notes: 'Test order'
      });
      expect(created).toBeTruthy();

      const item = Order.addItem(created.id, {
        product_id: ids.vaseId,
        artisan_id: ids.artId,
        quantity: 1,
        unit_price: 35
      });
      expect(item).toBeTruthy();

      const items = Order.getItems(created.id);
      expect(Array.isArray(items)).toBe(true);
      expect(items.length).toBeGreaterThan(0);

      const artisanItems = Order.getItemsByArtisan(created.id, ids.artId);
      expect(Array.isArray(artisanItems)).toBe(true);

      const updatedStatus = Order.updateStatus(created.id, 'processing');
      expect(updatedStatus.status).toBe('processing');

      const updatedPayment = Order.updatePaymentStatus(created.id, 'paid', 'TXN_TEST_1');
      expect(updatedPayment.payment_status).toBe('paid');
      expect(updatedPayment.transaction_ref).toBe('TXN_TEST_1');

      const cancelled = Order.cancel(created.id);
      expect(cancelled.status).toBe('cancelled');

      const refunded = Order.refund(created.id);
      expect(refunded.status).toBe('refunded');
      expect(refunded.payment_status).toBe('refunded');

      const revenueAll = Order.getRevenue({ date_from: '2000-01-01', date_to: '2999-01-01' });
      expect(typeof revenueAll).toBe('number');

      const revenueByArtisan = Order.getRevenue({ artisan_id: ids.artId, date_from: '2000-01-01' });
      expect(typeof revenueByArtisan).toBe('number');

      const recent = Order.getRecentByArtisan(ids.artId, 5);
      expect(Array.isArray(recent)).toBe(true);
    });
  });

};


