const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Cart & Checkout Flow', () => {
    test('Guest can add item to cart without authentication', async () => {
      const guest = request.agent(app);
      const addRes = await guest.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
      expect(addRes.statusCode).toBe(302);
      expect(addRes.headers.location).not.toContain('/auth/login');

      const cartRes = await guest.get('/cart');
      expect(cartRes.statusCode).toBe(200);
      expect(cartRes.text).toContain('Test Vase');
    });

    test('Cannot checkout with empty cart', async () => {
      const agent = await loginAs('customer2@test.com', 'cust123');
      const res = await agent.post('/orders/checkout');
      // Should redirect back with an error
      expect(res.statusCode).toBe(302);
    });

    test('Full checkout flow works', async () => {
      const agent = await loginAs('customer2@test.com', 'cust123');
      // Add to cart
      await agent.post('/cart/add').send({ productId: ids.ringId, quantity: 1 });
      // Go to checkout page
      const checkoutPage = await agent.get('/orders/checkout');
      expect(checkoutPage.statusCode).toBe(200);
      // Place order
      const res = await agent.post('/orders/checkout').send({
        shipping_address: '456 Test St',
        shipping_city: 'Manama',
        shipping_country: 'Bahrain',
        payment_method: 'card',
        card_number: '4242424242424242',
        card_expiry: '12/25',
        card_cvc: '123'
      });
      expect([200, 302]).toContain(res.statusCode);
    });
  });

  // ── Coupon Route ──
};

