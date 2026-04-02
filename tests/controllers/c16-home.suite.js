const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Cart and Home Controller Additional Coverage', () => {
    test('Cart xhr paths cover success, validation, coupon, remove-coupon and clear branches', async () => {
      const customerAgent = await loginAs('customer@test.com', 'cust123');

      await customerAgent.post('/cart/clear');

      const addOk = await customerAgent
        .post('/cart/add')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ productId: ids.vaseId, quantity: 1 });
      expect(addOk.statusCode).toBe(200);
      expect(addOk.body.success).toBe(true);

      const addMissingProduct = await customerAgent
        .post('/cart/add')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ productId: 999999, quantity: 1 });
      expect(addMissingProduct.statusCode).toBe(404);
      expect(addMissingProduct.body.success).toBe(false);

      const addInsufficientStock = await customerAgent
        .post('/cart/add')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ productId: ids.outOfStockId, quantity: 1 });
      expect(addInsufficientStock.statusCode).toBe(409);
      expect(addInsufficientStock.body.success).toBe(false);

      const overUpdate = await customerAgent
        .post('/cart/update')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ productId: ids.vaseId, quantity: 999 });
      expect(overUpdate.statusCode).toBe(409);
      expect(overUpdate.body.success).toBe(false);

      const updateOk = await customerAgent
        .post('/cart/update')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ productId: ids.vaseId, quantity: 2 });
      expect(updateOk.statusCode).toBe(200);
      expect(updateOk.body.success).toBe(true);

      const couponInvalid = await customerAgent
        .post('/cart/coupon')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ code: 'INVALID' });
      expect(couponInvalid.statusCode).toBe(400);
      expect(couponInvalid.body.success).toBe(false);

      const couponValid = await customerAgent
        .post('/cart/coupon')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ code: 'TEST10' });
      expect(couponValid.statusCode).toBe(200);
      expect(couponValid.body.success).toBe(true);

      const removeCoupon = await customerAgent
        .post('/cart/coupon/remove')
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(removeCoupon.statusCode).toBe(200);
      expect(removeCoupon.body.success).toBe(true);

      const removeItem = await customerAgent
        .post('/cart/remove')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ productId: ids.vaseId });
      expect(removeItem.statusCode).toBe(200);
      expect(removeItem.body.success).toBe(true);

      const clearCart = await customerAgent
        .post('/cart/clear')
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(clearCart.statusCode).toBe(200);
      expect(clearCart.body.success).toBe(true);

      await customerAgent.post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
      await customerAgent.post('/cart/coupon').send({ code: 'TEST10' });
      db.prepare('UPDATE coupons SET is_active = 0, active = 0 WHERE code = ?').run('TEST10');

      const cartAfterCouponDisable = await customerAgent.get('/cart');
      expect(cartAfterCouponDisable.statusCode).toBe(200);

      db.prepare('UPDATE coupons SET is_active = 1, active = 1 WHERE code = ?').run('TEST10');
    });

    test('Cart and home catch branches execute safely when dependencies throw', async () => {
      const Cart = require('../../models/Cart');
      const Product = require('../../models/Product');

      const cartIndexSpy = jest.spyOn(Cart, 'getItems').mockImplementation(() => {
        throw new Error('Forced cart index error');
      });
      const cartIndexFallback = await request(app).get('/cart');
      expect(cartIndexFallback.statusCode).toBe(302);
      expect(cartIndexFallback.headers.location).toBe('/');
      cartIndexSpy.mockRestore();

      const addErrorSpy = jest.spyOn(Product, 'findById').mockImplementation(() => {
        throw new Error('Forced add item error');
      });
      const addFallback = await request(app).post('/cart/add').send({ productId: ids.vaseId, quantity: 1 });
      expect(addFallback.statusCode).toBe(302);
      addErrorSpy.mockRestore();

      const homeIndexSpy = jest.spyOn(Product, 'getFeatured').mockImplementation(() => {
        throw new Error('Forced home index error');
      });
      const homeFallback = await request(app).get('/');
      expect(homeFallback.statusCode).toBe(200);
      homeIndexSpy.mockRestore();
    });

    test('Home pages and subscribe endpoint cover validation and success branches', async () => {
      const contact = await request(app).get('/contact');
      expect(contact.statusCode).toBe(200);

      const terms = await request(app).get('/terms');
      expect(terms.statusCode).toBe(200);

      const privacy = await request(app).get('/privacy');
      expect(privacy.statusCode).toBe(200);

      const badSubscribe = await request(app).post('/subscribe').send({ email: 'invalid-email' });
      expect(badSubscribe.statusCode).toBe(302);

      const goodEmail = `${makeUnique('newsletter')}@test.com`;
      const goodSubscribe = await request(app).post('/subscribe').send({ email: goodEmail });
      expect(goodSubscribe.statusCode).toBe(302);

      const subscribed = db.prepare('SELECT email FROM newsletter_subscriptions WHERE email = ?').get(goodEmail);
      expect(subscribed).toBeTruthy();
      expect(subscribed.email).toBe(goodEmail);
    });
  });
};

