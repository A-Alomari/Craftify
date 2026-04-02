const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Product, Auction, and Order Controller Additional Coverage', () => {
    test('Order routes cover checkout validations, confirmation/tracking ownership, and cancellation rules', async () => {
      const customerAgent = await loginAs('customer@test.com', 'cust123');
      const customer2Agent = await loginAs('customer2@test.com', 'cust123');

      await customer2Agent.post('/cart/clear');

      const emptyCheckout = await customer2Agent.get('/orders/checkout');
      expect(emptyCheckout.statusCode).toBe(302);
      expect(emptyCheckout.headers.location).toContain('/cart');

      await customer2Agent.post('/cart/add').send({ productId: ids.outOfStockId, quantity: 1 });
      const stockIssueCheckout = await customer2Agent.get('/orders/checkout');
      expect(stockIssueCheckout.statusCode).toBe(302);
      expect(stockIssueCheckout.headers.location).toContain('/cart');

      await customer2Agent.post('/cart/clear');
      await customer2Agent.post('/cart/add').send({ productId: ids.ringId, quantity: 1 });

      const missingRequired = await customer2Agent.post('/orders/checkout').send({
        shipping_address: '',
        shipping_city: '',
        payment_method: ''
      });
      expect(missingRequired.statusCode).toBe(302);
      expect(missingRequired.headers.location).toContain('/orders/checkout');

      const missingCardDetails = await customer2Agent.post('/orders/checkout').send({
        shipping_address: 'Road 1',
        shipping_city: 'Manama',
        shipping_country: 'Bahrain',
        payment_method: 'card'
      });
      expect(missingCardDetails.statusCode).toBe(302);
      expect(missingCardDetails.headers.location).toContain('/orders/checkout');

      const invalidCardNumber = await customer2Agent.post('/orders/checkout').send({
        shipping_address: 'Road 1',
        shipping_city: 'Manama',
        shipping_country: 'Bahrain',
        payment_method: 'card',
        card_number: '123',
        card_expiry: '12/25',
        card_cvc: '123'
      });
      expect(invalidCardNumber.statusCode).toBe(302);
      expect(invalidCardNumber.headers.location).toContain('/orders/checkout');

      const invalidCardExpiry = await customer2Agent.post('/orders/checkout').send({
        shipping_address: 'Road 1',
        shipping_city: 'Manama',
        shipping_country: 'Bahrain',
        payment_method: 'card',
        card_number: '4242424242424',
        card_expiry: '1225',
        card_cvc: '123'
      });
      expect(invalidCardExpiry.statusCode).toBe(302);
      expect(invalidCardExpiry.headers.location).toContain('/orders/checkout');

      const invalidCardCvc = await customer2Agent.post('/orders/checkout').send({
        shipping_address: 'Road 1',
        shipping_city: 'Manama',
        shipping_country: 'Bahrain',
        payment_method: 'card',
        card_number: '4242424242424',
        card_expiry: '12/25',
        card_cvc: '12'
      });
      expect(invalidCardCvc.statusCode).toBe(302);
      expect(invalidCardCvc.headers.location).toContain('/orders/checkout');

      await customer2Agent.post('/cart/coupon').send({ code: 'TEST10' });
      const paidByCash = await customer2Agent.post('/orders/checkout').send({
        shipping_address: 'Road 100',
        shipping_city: 'Manama',
        shipping_country: 'Bahrain',
        payment_method: 'cash',
        notes: 'Cash order for coverage'
      });
      expect(paidByCash.statusCode).toBe(302);
      expect(paidByCash.headers.location).toMatch(/\/orders\/\d+\/confirmation/);

      const placedOrderId = parseInt(paidByCash.headers.location.match(/\/orders\/(\d+)\/confirmation/)[1], 10);

      const confirmation = await customer2Agent.get(`/orders/${placedOrderId}/confirmation`);
      expect(confirmation.statusCode).toBe(200);

      const tracking = await customer2Agent.get(`/orders/${placedOrderId}/track`);
      expect(tracking.statusCode).toBe(200);

      const unauthorizedConfirmation = await customerAgent.get(`/orders/${placedOrderId}/confirmation`);
      expect(unauthorizedConfirmation.statusCode).toBe(302);
      expect(unauthorizedConfirmation.headers.location).toContain('/orders');

      const unauthorizedTracking = await customerAgent.get(`/orders/${placedOrderId}/track`);
      expect(unauthorizedTracking.statusCode).toBe(302);
      expect(unauthorizedTracking.headers.location).toContain('/orders');

      const cancellableOrderId = db.prepare(`
        INSERT INTO orders (
          user_id, subtotal, shipping_cost, discount_amount, total_amount,
          status, payment_method, payment_status, shipping_address, shipping_city, shipping_country
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(ids.cust2Id, 45, 0, 0, 45, 'confirmed', 'cash', 'paid', 'Road 200', 'Manama', 'Bahrain').lastInsertRowid;
      db.prepare('INSERT INTO order_items (order_id, product_id, artisan_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?)')
        .run(cancellableOrderId, ids.vaseId, ids.artId, 1, 45, 45);

      const stockBefore = db.prepare('SELECT stock FROM products WHERE id = ?').get(ids.vaseId).stock;
      const cancelSuccess = await customer2Agent.post(`/orders/${cancellableOrderId}/cancel`);
      expect(cancelSuccess.statusCode).toBe(302);
      expect(cancelSuccess.headers.location).toContain('/orders');
      expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(cancellableOrderId).status).toBe('cancelled');

      const stockAfter = db.prepare('SELECT stock FROM products WHERE id = ?').get(ids.vaseId).stock;
      expect(stockAfter).toBe(stockBefore + 1);

      const cannotCancelDelivered = await customerAgent.post(`/orders/${ids.orderId}/cancel`);
      expect(cannotCancelDelivered.statusCode).toBe(302);
      expect(cannotCancelDelivered.headers.location).toContain(`/orders/${ids.orderId}`);
    });

  });
};
