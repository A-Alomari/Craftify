module.exports = ({ createReqRes, getIds }) => {
    test('Residual order, user, and api branch fallbacks are covered', async () => {
      const ids = getIds();
      const request = require('supertest');
      const express = require('express');

      const orderController = require('../../controllers/orderController');
      const userController = require('../../controllers/userController');

      const Cart = require('../../models/Cart');
      const Coupon = require('../../models/Coupon');
      const Review = require('../../models/Review');

      let pair;

      jest.spyOn(Cart, 'getItems').mockReturnValue([{ images: '[]' }]);
      jest.spyOn(Cart, 'validateItems').mockReturnValue([]);
      jest.spyOn(Cart, 'getTotal').mockReturnValue({ total: 22, item_count: 1 });
      jest.spyOn(Coupon, 'validate').mockReturnValue({ valid: false, discount: 99 });

      pair = createReqRes({
        session: { user: { id: ids.custId }, appliedCoupon: { code: 'INVALID' } }
      });
      orderController.checkout(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalledWith(
        'orders/checkout',
        expect.objectContaining({ discount: 0 })
      );

      pair = createReqRes({
        session: { user: { id: ids.custId }, appliedCoupon: { code: 'INVALID' } },
        body: {
          shipping_address: '',
          shipping_city: '',
          payment_method: 'cash'
        }
      });
      orderController.placeOrder(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/orders/checkout');

      jest.spyOn(Review, 'canReview').mockReturnValue({ canReview: true });
      jest.spyOn(Review, 'create').mockImplementation(() => {
        throw new Error('review fallback');
      });
      pair = createReqRes({
        session: { user: { id: ids.custId } },
        body: {
          product_id: ids.vaseId,
          rating: 5,
          title: 'Valid Title',
          comment: 'Valid review comment'
        },
        xhr: false,
        get: jest.fn(() => undefined)
      });
      userController.createReview(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/products');

      let apiApp;

      jest.isolateModules(() => {
        jest.doMock('../../middleware/auth', () => ({
          attachUser: (req, res, next) => next()
        }));
        jest.doMock('../../models/Product', () => ({ findAll: jest.fn(() => []) }));
        jest.doMock('../../models/Category', () => ({ findAll: jest.fn(() => []) }));
        jest.doMock('../../models/ArtisanProfile', () => ({ findAll: jest.fn(() => []) }));
        jest.doMock('../../models/Cart', () => ({ getCount: jest.fn(() => 10) }));
        jest.doMock('../../models/Notification', () => ({
          findByUserId: jest.fn(() => []),
          getUnreadCount: jest.fn(() => 0)
        }));
        jest.doMock('../../models/Wishlist', () => ({ isInWishlist: jest.fn(() => false) }));
        jest.doMock('../../models/Auction', () => ({
          findById: jest.fn(() => null),
          getBids: jest.fn(() => [])
        }));
        jest.doMock('../../models/Coupon', () => ({ validate: jest.fn(() => ({ valid: true })) }));

        const router = require('../../routes/api');

        apiApp = express();
        apiApp.use(express.json());
        apiApp.use('/api', router);
      });

      const cartCountWithoutIdentity = await request(apiApp).get('/api/cart/count');
      expect(cartCountWithoutIdentity.statusCode).toBe(200);
      expect(cartCountWithoutIdentity.body).toEqual({ count: 0 });

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
};
