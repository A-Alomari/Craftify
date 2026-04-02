const request = require('supertest');

module.exports = ({ getTestContext }) => {
  let ids;

  beforeAll(() => {
    ({ ids } = getTestContext());
  });

  describe('Core Module Coverage', () => {
    afterEach(() => {
      jest.restoreAllMocks();
      jest.clearAllMocks();
      jest.dontMock('nodemailer');
      jest.dontMock('../../middleware/auth');
      jest.dontMock('../../models/Product');
      jest.dontMock('../../models/Category');
      jest.dontMock('../../models/ArtisanProfile');
      jest.dontMock('../../models/Cart');
      jest.dontMock('../../models/Notification');
      jest.dontMock('../../models/Wishlist');
      jest.dontMock('../../models/Auction');
      jest.dontMock('../../models/Coupon');
    });

    test('Auth middleware branches and sanitizer helpers are covered', () => {
      const auth = require('../../middleware/auth');
      const sanitizer = require('../../utils/sanitizer');
      const database = require('../../config/database');

      const next = jest.fn();
      const authReq = {
        session: { user: { id: ids.custId } },
        flash: jest.fn()
      };
      auth.isAuthenticated(authReq, { redirect: jest.fn() }, next);
      expect(next).toHaveBeenCalled();

      const guestReq = { session: { user: { id: ids.custId } } };
      const guestRes = { redirect: jest.fn() };
      auth.isGuest(guestReq, guestRes, next);
      expect(guestRes.redirect).toHaveBeenCalledWith('/');

      const customerAllowedReq = {
        session: { user: { role: 'customer' } },
        flash: jest.fn()
      };
      auth.isCustomer(customerAllowedReq, { redirect: jest.fn() }, next);
      expect(next).toHaveBeenCalled();

      const customerReq = {
        session: { user: { role: 'artisan' } },
        flash: jest.fn()
      };
      const customerRes = { redirect: jest.fn() };
      auth.isCustomer(customerReq, customerRes, next);
      expect(customerRes.redirect).toHaveBeenCalledWith('/');

      const nonArtisanReq = {
        session: { user: { id: ids.custId, role: 'customer' } },
        flash: jest.fn()
      };
      const nonArtisanRes = { redirect: jest.fn() };
      auth.isApprovedArtisan(nonArtisanReq, nonArtisanRes, next);
      expect(nonArtisanRes.redirect).toHaveBeenCalledWith('/');

      jest.spyOn(database, 'getDb').mockReturnValue({
        prepare: () => ({ get: () => ({ is_approved: 1 }) })
      });
      const approvedReq = {
        session: { user: { id: ids.artId, role: 'artisan' } },
        flash: jest.fn()
      };
      const approvedRes = { redirect: jest.fn() };
      auth.isApprovedArtisan(approvedReq, approvedRes, next);
      expect(next).toHaveBeenCalled();

      database.getDb.mockReturnValue({
        prepare: () => ({ get: () => ({ is_approved: 0 }) })
      });
      const pendingReq = {
        session: { user: { id: ids.artId, role: 'artisan' } },
        flash: jest.fn()
      };
      const pendingRes = { redirect: jest.fn() };
      auth.isApprovedArtisan(pendingReq, pendingRes, jest.fn());
      expect(pendingRes.redirect).toHaveBeenCalledWith('/artisan/pending');

      database.getDb.mockImplementation(() => {
        throw new Error('db offline');
      });
      const dbFailReq = {
        session: { user: { id: ids.artId, role: 'artisan' } },
        flash: jest.fn()
      };
      const dbFailRes = { redirect: jest.fn() };
      auth.isApprovedArtisan(dbFailReq, dbFailRes, jest.fn());
      expect(dbFailRes.redirect).toHaveBeenCalledWith('/artisan/pending');

      const destroy = jest.fn();
      const inactiveReq = {
        session: { user: { status: 'suspended' }, destroy },
        flash: jest.fn()
      };
      const inactiveRes = { redirect: jest.fn() };
      auth.isActive(inactiveReq, inactiveRes, jest.fn());
      expect(destroy).toHaveBeenCalled();
      expect(inactiveRes.redirect).toHaveBeenCalledWith('/auth/login');

      const activeReq = {
        session: { user: { status: 'active' }, destroy: jest.fn() },
        flash: jest.fn()
      };
      auth.isActive(activeReq, { redirect: jest.fn() }, next);
      expect(next).toHaveBeenCalled();

      const attachReq = { session: { user: { id: 33 } } };
      auth.attachUser(attachReq, {}, jest.fn());
      expect(attachReq.user).toEqual({ id: 33 });

      expect(sanitizer.sanitizeString(456)).toBe(456);
      expect(sanitizer.sanitizeText('  Hello  ')).toBe('Hello');
      expect(sanitizer.sanitizeText(123)).toBe(123);

      const productValidation = sanitizer.validateProductInput({
        name: 'Valid Product',
        description: 'x'.repeat(5100)
      });
      expect(productValidation.errors.length).toBeGreaterThan(0);

      const reviewValidation = sanitizer.validateReviewInput({
        title: 'Good',
        comment: 'y'.repeat(1100)
      });
      expect(reviewValidation.errors.length).toBeGreaterThan(0);
    });

    test('Email utility test and non-test transporter branches are covered', async () => {
      const originalEnv = process.env.NODE_ENV;

      process.env.NODE_ENV = 'test';
      let emailUtils;
      let testCreateTransport;

      jest.isolateModules(() => {
        testCreateTransport = jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: 'msg-test' }) }));
        jest.doMock('nodemailer', () => ({ createTransport: testCreateTransport }));
        emailUtils = require('../../utils/email');
      });

      const t1 = emailUtils.getTransporter();
      const t2 = emailUtils.getTransporter();
      expect(t1).toBe(t2);
      expect(testCreateTransport).toHaveBeenCalledTimes(1);

      process.env.NODE_ENV = 'development';
      let sendSuccess;
      let devCreateTransport;
      let devEmailUtils;

      jest.isolateModules(() => {
        sendSuccess = jest.fn().mockResolvedValue({ messageId: 'msg-dev' });
        devCreateTransport = jest.fn(() => ({ sendMail: sendSuccess }));
        jest.doMock('nodemailer', () => ({ createTransport: devCreateTransport }));
        devEmailUtils = require('../../utils/email');
      });

      const resetResult = await devEmailUtils.sendPasswordResetEmail('user@test.com', 'token123', 'User');
      expect(resetResult.success).toBe(true);
      expect(resetResult.messageId).toBe('msg-dev');

      const welcomeResult = await devEmailUtils.sendWelcomeEmail('user@test.com', 'User');
      expect(welcomeResult.success).toBe(true);
      expect(devCreateTransport).toHaveBeenCalledTimes(1);

      process.env.APP_URL = 'https://craftify.example';
      process.env.EMAIL_FROM = 'Craftify QA <qa@craftify.example>';
      await devEmailUtils.sendPasswordResetEmail('fallback@test.com', 'token-fallback');
      await devEmailUtils.sendWelcomeEmail('fallback@test.com');
      const latestMail = sendSuccess.mock.calls[sendSuccess.mock.calls.length - 1][0];
      expect(latestMail.from).toContain('qa@craftify.example');
      delete process.env.APP_URL;
      delete process.env.EMAIL_FROM;

      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_PORT = '2525';
      process.env.EMAIL_SECURE = 'true';
      process.env.EMAIL_USER = 'smtp-user';
      process.env.EMAIL_PASS = 'smtp-pass';
      let envCreateTransport;
      let envEmailUtils;
      jest.isolateModules(() => {
        envCreateTransport = jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({ messageId: 'env-msg' }) }));
        jest.doMock('nodemailer', () => ({ createTransport: envCreateTransport }));
        envEmailUtils = require('../../utils/email');
      });
      envEmailUtils.getTransporter();
      expect(envCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 2525,
          secure: true,
          auth: expect.objectContaining({ user: 'smtp-user', pass: 'smtp-pass' })
        })
      );
      delete process.env.EMAIL_HOST;
      delete process.env.EMAIL_PORT;
      delete process.env.EMAIL_SECURE;
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;

      let failEmailUtils;
      jest.isolateModules(() => {
        const sendFail = jest.fn().mockRejectedValue(new Error('smtp fail'));
        jest.doMock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: sendFail })) }));
        failEmailUtils = require('../../utils/email');
      });

      await expect(
        failEmailUtils.sendPasswordResetEmail('user@test.com', 'tok', 'User')
      ).rejects.toThrow('smtp fail');

      const welcomeFail = await failEmailUtils.sendWelcomeEmail('user@test.com', 'User');
      expect(welcomeFail.success).toBe(false);
      expect(welcomeFail.error).toContain('smtp fail');

      process.env.NODE_ENV = originalEnv;
    });

    test('API route catch branches are covered through isolated route app', async () => {
      const buildApiApp = ({
        productFindAll,
        categoryFindAll,
        artisanFindAll,
        cartGetCount,
        notificationFind,
        notificationCount,
        auctionFindById,
        couponValidate
      }) => {
        let app;

        jest.isolateModules(() => {
          jest.doMock('../../middleware/auth', () => ({
            attachUser: (req, res, next) => {
              const uid = req.headers['x-user-id'];
              if (uid) {
                req.user = { id: parseInt(uid, 10) };
              }
              const sid = req.headers['x-session-id'];
              if (sid) {
                req.sessionID = String(sid);
              }
              next();
            }
          }));

          jest.doMock('../../models/Product', () => ({
            findAll: jest.fn(productFindAll || (() => []))
          }));
          jest.doMock('../../models/Category', () => ({
            findAll: jest.fn(categoryFindAll || (() => []))
          }));
          jest.doMock('../../models/ArtisanProfile', () => ({
            findAll: jest.fn(artisanFindAll || (() => []))
          }));
          jest.doMock('../../models/Cart', () => ({
            getCount: jest.fn(cartGetCount || (() => 0))
          }));
          jest.doMock('../../models/Notification', () => ({
            findByUserId: jest.fn(notificationFind || (() => [])),
            getUnreadCount: jest.fn(notificationCount || (() => 0))
          }));
          jest.doMock('../../models/Wishlist', () => ({
            isInWishlist: jest.fn(() => false)
          }));
          jest.doMock('../../models/Auction', () => ({
            findById: jest.fn(auctionFindById || (() => ({ id: 1, starting_price: 10, status: 'active', bid_count: 0 }))),
            getBids: jest.fn(() => [])
          }));
          jest.doMock('../../models/Coupon', () => ({
            validate: jest.fn(couponValidate || (() => ({ valid: true })))
          }));

          const express = require('express');
          const router = require('../../routes/api');

          app = express();
          app.use(express.json());
          app.use('/api', router);
        });

        return app;
      };

      let apiApp = buildApiApp({ productFindAll: () => { throw new Error('products fail'); } });
      const productsFail = await request(apiApp).get('/api/products');
      expect(productsFail.statusCode).toBe(500);

      apiApp = buildApiApp({
        productFindAll: () => [{ id: 1, name: 'Product 1', price: 10, category_name: 'Cat', artisan_name: 'Artisan Fallback' }]
      });
      const productsOk = await request(apiApp).get('/api/products');
      expect(productsOk.statusCode).toBe(200);
      expect(productsOk.body[0].artisan).toBe('Artisan Fallback');

      apiApp = buildApiApp({
        productFindAll: () => [{ id: 2, name: 'Product 2', price: 15, category_name: 'Cat', shop_name: 'Shop Name' }]
      });
      const productsShop = await request(apiApp).get('/api/products');
      expect(productsShop.statusCode).toBe(200);
      expect(productsShop.body[0].artisan).toBe('Shop Name');

      apiApp = buildApiApp({ cartGetCount: () => { throw new Error('cart fail'); } });
      const cartFail = await request(apiApp)
        .get('/api/cart/count')
        .set('x-user-id', String(ids.custId));
      expect(cartFail.statusCode).toBe(500);
      expect(cartFail.body.count).toBe(0);

      apiApp = buildApiApp({ cartGetCount: () => 7 });
      const cartSession = await request(apiApp)
        .get('/api/cart/count')
        .set('x-session-id', 'guest-123');
      expect(cartSession.statusCode).toBe(200);
      expect(typeof cartSession.body.count).toBe('number');

      apiApp = buildApiApp({
        notificationFind: () => { throw new Error('notif fail'); },
        notificationCount: () => { throw new Error('notif count fail'); }
      });
      const notificationsFail = await request(apiApp)
        .get('/api/notifications')
        .set('x-user-id', String(ids.custId));
      expect(notificationsFail.statusCode).toBe(500);
      expect(notificationsFail.body.count).toBe(0);

      apiApp = buildApiApp({ auctionFindById: () => { throw new Error('auction fail'); } });
      const auctionFail = await request(apiApp).get('/api/auctions/1/updates');
      expect(auctionFail.statusCode).toBe(500);

      apiApp = buildApiApp({ couponValidate: () => { throw new Error('coupon fail'); } });
      const couponFail = await request(apiApp)
        .post('/api/coupons/validate')
        .send({ code: 'X', total: 100 });
      expect(couponFail.statusCode).toBe(500);
      expect(couponFail.body.valid).toBe(false);

      apiApp = buildApiApp({
        productFindAll: () => { throw new Error('search fail'); },
        categoryFindAll: () => [{ name: 'Any' }],
        artisanFindAll: () => []
      });
      const searchFail = await request(apiApp).get('/api/search/suggestions?q=ring');
      expect(searchFail.statusCode).toBe(500);
      expect(searchFail.body.suggestions).toEqual([]);

      apiApp = buildApiApp({
        productFindAll: () => [{ name: 'Ring Product' }],
        categoryFindAll: () => [{ name: 'Ring Category' }],
        artisanFindAll: () => [{ shop_name: 'Ring Artisan' }]
      });
      const searchOk = await request(apiApp).get('/api/search/suggestions?q=ring');
      expect(searchOk.statusCode).toBe(200);
      expect(searchOk.body.suggestions.some((s) => s.type === 'category')).toBe(true);
    });
  });
};
