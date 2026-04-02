module.exports = ({ createReqRes, getIds, makeUnique }) => {
    test('Auth, cart, order, user, and home controller remaining branches are covered', async () => {
      const ids = getIds();
      const authController = require('../../controllers/authController');
      const cartController = require('../../controllers/cartController');
      const orderController = require('../../controllers/orderController');
      const userController = require('../../controllers/userController');
      const homeController = require('../../controllers/homeController');

      const User = require('../../models/User');
      const ArtisanProfile = require('../../models/ArtisanProfile');
      const Cart = require('../../models/Cart');
      const Product = require('../../models/Product');
      const Coupon = require('../../models/Coupon');
      const Review = require('../../models/Review');
      const Notification = require('../../models/Notification');
      const Message = require('../../models/Message');
      const Order = require('../../models/Order');
      const Shipment = require('../../models/Shipment');
      const database = require('../../config/database');
      const email = require('../../utils/email');
      const productFindByIdSpy = jest.spyOn(Product, 'findById');
      const orderFindByIdSpy = jest.spyOn(Order, 'findById');

      let pair;

      jest.spyOn(User, 'verifyPassword').mockRejectedValue(new Error('login crash'));
      pair = createReqRes({ body: { email: 'x@test.com', password: 'bad' } });
      await authController.login(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/login');

      pair = createReqRes({
        body: {
          name: '',
          email: '',
          password: '123',
          confirm_password: '321'
        }
      });
      await authController.register(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/register');

      jest.spyOn(User, 'create').mockRejectedValue(new Error('register crash'));
      pair = createReqRes({
        body: {
          name: 'Name',
          email: `${makeUnique('reg')}@test.com`,
          password: 'abcdef',
          confirm_password: 'abcdef'
        }
      });
      await authController.register(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/register');

      pair = createReqRes({
        body: {
          name: 'Artisan',
          email: `${makeUnique('art')}@test.com`,
          password: 'abcdef',
          confirm_password: 'zzz',
          shop_name: 'Shop'
        }
      });
      await authController.registerArtisan(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/artisan-register');

      User.create.mockRejectedValueOnce(new Error('Email already registered'));
      pair = createReqRes({
        body: {
          name: 'Artisan',
          email: `${makeUnique('dup')}@test.com`,
          password: 'abcdef',
          confirm_password: 'abcdef',
          shop_name: 'Shop'
        }
      });
      await authController.registerArtisan(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/artisan-register');

      User.create.mockRejectedValueOnce(new Error('artisan crash'));
      pair = createReqRes({
        body: {
          name: 'Artisan',
          email: `${makeUnique('bad')}@test.com`,
          password: 'abcdef',
          confirm_password: 'abcdef',
          shop_name: 'Shop'
        }
      });
      await authController.registerArtisan(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/artisan-register');

      jest.spyOn(User, 'findByEmail').mockReturnValue({ id: ids.custId, email: 'customer@test.com', name: 'Customer' });
      jest.spyOn(database, 'getDb').mockReturnValue({
        prepare: () => ({ run: jest.fn() })
      });
      jest.spyOn(email, 'sendPasswordResetEmail').mockResolvedValue({ success: true, messageId: 'mid' });
      pair = createReqRes({ body: { email: 'customer@test.com' } });
      await authController.forgotPassword(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/forgot-password');

      database.getDb.mockImplementationOnce(() => {
        throw new Error('forgot fail');
      });
      pair = createReqRes({ body: { email: 'customer@test.com' } });
      await authController.forgotPassword(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/forgot-password');

      database.getDb.mockReturnValue({
        prepare: () => ({ get: () => null })
      });
      pair = createReqRes({ params: { token: 'missing' }, body: { password: 'abcdef', confirm_password: 'abcdef' } });
      await authController.resetPassword(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/forgot-password');

      database.getDb.mockImplementationOnce(() => {
        throw new Error('reset fail');
      });
      pair = createReqRes({ params: { token: 'broken' }, body: { password: 'abcdef', confirm_password: 'abcdef' } });
      await authController.resetPassword(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/forgot-password');

      // Clear one-off auth DB mocks before moving into cart/order controller branches.
      database.getDb.mockReset();
      database.getDb.mockReturnValue({ transaction: jest.fn(), prepare: () => ({ run: jest.fn(), get: jest.fn(), all: jest.fn() }) });

      jest.spyOn(Cart, 'getItems').mockReturnValue([{ images: '[]' }]);
      jest.spyOn(Cart, 'getTotal').mockReturnValue({ total: 40, item_count: 1 });
      jest.spyOn(Coupon, 'validate').mockReturnValue({ valid: true, discount: 5, coupon: { code: 'X', description: 'D' } });
      pair = createReqRes({ session: { user: { id: ids.custId }, appliedCoupon: { code: 'X' } } });
      cartController.index(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalledWith(
        'cart/index',
        expect.objectContaining({ discount: 5 })
      );

      productFindByIdSpy.mockReturnValue(null);
      pair = createReqRes({ body: { productId: 999999, quantity: 1 }, xhr: false });
      cartController.addItem(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalled();

      productFindByIdSpy.mockReturnValue({ stock: 1, status: 'approved' });
      pair = createReqRes({ body: { productId: ids.vaseId, quantity: 5 }, xhr: false });
      cartController.updateItem(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      productFindByIdSpy.mockImplementation(() => {
        throw new Error('update fail');
      });
      pair = createReqRes({ body: { productId: ids.vaseId, quantity: 1 }, xhr: false });
      cartController.updateItem(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      jest.spyOn(Cart, 'removeItem').mockImplementation(() => {
        throw new Error('remove fail');
      });
      pair = createReqRes({ body: { productId: ids.vaseId }, xhr: false });
      cartController.removeItem(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      jest.spyOn(Cart, 'getTotal').mockImplementation(() => {
        throw new Error('coupon crash');
      });
      pair = createReqRes({ body: { code: 'TEST10' }, xhr: false });
      cartController.applyCoupon(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      pair = createReqRes({ xhr: false, session: { user: { id: ids.custId }, appliedCoupon: { code: 'TEST10' } } });
      cartController.removeCoupon(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      jest.spyOn(Cart, 'clear').mockImplementation(() => {
        throw new Error('clear crash');
      });
      pair = createReqRes({ xhr: false });
      cartController.clear(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      jest.spyOn(Cart, 'getItems').mockReturnValue([{ images: '[]' }]);
      jest.spyOn(Cart, 'validateItems').mockReturnValue([{ name: 'Item', available: 0 }]);
      pair = createReqRes({ session: { user: { id: ids.custId } } });
      orderController.checkout(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      Cart.validateItems.mockReturnValue([]);
      Cart.getTotal.mockReturnValue({ total: 20, item_count: 1 });
      Coupon.validate.mockReturnValue({ valid: true, discount: 3, coupon: { code: 'TEST10' } });
      pair = createReqRes({ session: { user: { id: ids.custId }, appliedCoupon: { code: 'TEST10' } } });
      orderController.checkout(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalledWith(
        'orders/checkout',
        expect.objectContaining({ discount: 3 })
      );

      Cart.getItems.mockReturnValue([{ product_id: ids.vaseId, artisan_id: ids.artId, quantity: 1, price: 5, images: '[]' }]);
      Cart.validateItems
        .mockReturnValueOnce([])
        .mockReturnValueOnce([{ name: 'Late Out of Stock', available: 0 }]);
      Cart.getTotal.mockReturnValue({ total: 5, item_count: 1 });
      pair = createReqRes({
        session: { user: { id: ids.custId }, appliedCoupon: null },
        body: {
          shipping_address: 'Road 1',
          shipping_city: 'Manama',
          shipping_country: 'Bahrain',
          payment_method: 'cash'
        }
      });
      jest.spyOn(database, 'getDb').mockReturnValue({ transaction: jest.fn() });
      orderController.placeOrder(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      Cart.getItems.mockReturnValue([{ product_id: ids.vaseId, artisan_id: ids.artId, quantity: 1, price: -10, images: '[]' }]);
      Cart.validateItems.mockReturnValue([]);
      Cart.getTotal.mockReturnValue({ total: -10, item_count: 1 });
      pair = createReqRes({
        session: { user: { id: ids.custId }, appliedCoupon: null },
        body: {
          shipping_address: 'Road 1',
          shipping_city: 'Manama',
          shipping_country: 'Bahrain',
          payment_method: 'card',
          card_number: '4242424242424242',
          card_expiry: '12/99',
          card_cvc: '123'
        }
      });
      orderController.placeOrder(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/orders/checkout');

      jest.spyOn(Order, 'findByUserId').mockImplementation(() => {
        throw new Error('orders index fail');
      });
      pair = createReqRes({ session: { user: { id: ids.custId } } });
      orderController.index(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/');

      orderFindByIdSpy.mockReturnValue(null);
      pair = createReqRes({ params: { id: String(ids.orderId) }, session: { user: { id: ids.custId } } });
      orderController.show(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/orders');

      pair = createReqRes({ params: { id: String(ids.orderId) }, session: { user: { id: ids.custId } } });
      orderController.cancel(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/orders');

      orderFindByIdSpy.mockImplementation(() => {
        throw new Error('cancel fail');
      });
      pair = createReqRes({ params: { id: String(ids.orderId) }, session: { user: { id: ids.custId } } });
      orderController.cancel(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/orders');

      jest.spyOn(User, 'update').mockReturnValue(true);
      pair = createReqRes({
        session: { user: { id: ids.custId, name: 'Customer', email: 'customer@test.com' } },
        body: { name: 'Customer', phone: '111', shipping_address: 'Road 7' },
        file: { filename: 'avatar.png' }
      });
      await userController.updateProfile(pair.req, pair.res);
      expect(pair.req.session.user.avatar).toBe('/uploads/avatar.png');

      const Wishlist = require('../../models/Wishlist');
      jest.spyOn(Wishlist, 'add').mockImplementation(() => {
        throw new Error('wishlist add fail');
      });
      pair = createReqRes({ body: { productId: ids.vaseId }, xhr: false, session: { user: { id: ids.custId } } });
      userController.addToWishlist(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalled();

      jest.spyOn(Wishlist, 'remove').mockImplementation(() => {
        throw new Error('wishlist remove fail');
      });
      pair = createReqRes({ body: { productId: ids.vaseId }, xhr: false, session: { user: { id: ids.custId } } });
      userController.removeFromWishlist(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/user/wishlist');

      jest.spyOn(Wishlist, 'toggle').mockImplementation(() => {
        throw new Error('wishlist toggle fail');
      });
      pair = createReqRes({ body: { productId: ids.vaseId }, xhr: false, session: { user: { id: ids.custId } } });
      userController.toggleWishlist(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalled();

      jest.spyOn(Wishlist, 'moveToCart').mockImplementation(() => {
        throw new Error('wishlist move fail');
      });
      pair = createReqRes({ body: { productId: ids.vaseId }, xhr: false, session: { user: { id: ids.custId } } });
      userController.moveToCart(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/user/wishlist');

      jest.spyOn(Review, 'canReview').mockReturnValue({ canReview: true });
      jest.spyOn(Review, 'create').mockImplementation(() => {
        throw new Error('review create fail');
      });
      pair = createReqRes({
        session: { user: { id: ids.custId } },
        body: {
          product_id: ids.vaseId,
          rating: 5,
          title: 'Title',
          comment: 'Comment'
        },
        xhr: false
      });
      userController.createReview(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalled();

      jest.spyOn(Review, 'findById').mockReturnValue({ id: 7, user_id: ids.custId });
      jest.spyOn(Review, 'delete').mockImplementation(() => {
        throw new Error('review delete fail');
      });
      pair = createReqRes({ params: { id: '7' }, session: { user: { id: ids.custId } }, xhr: false });
      userController.deleteReview(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/user/reviews');

      jest.spyOn(Notification, 'markAsRead').mockImplementation(() => {
        throw new Error('notif mark fail');
      });
      pair = createReqRes({ params: { id: '1' }, xhr: false });
      userController.markNotificationRead(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/user/notifications');

      jest.spyOn(Notification, 'markAllAsRead').mockImplementation(() => {
        throw new Error('notif mark all fail');
      });
      pair = createReqRes({ session: { user: { id: ids.custId } }, xhr: false });
      userController.markAllNotificationsRead(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/user/notifications');

      jest.spyOn(Notification, 'delete').mockImplementation(() => {
        throw new Error('notif delete fail');
      });
      pair = createReqRes({ params: { id: '1' }, xhr: false });
      userController.deleteNotification(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/user/notifications');

      jest.spyOn(Message, 'create').mockImplementation(() => {
        throw new Error('message fail');
      });
      pair = createReqRes({
        session: { user: { id: ids.custId, name: 'Customer' } },
        body: { receiver_id: String(ids.artId), content: 'Hello' },
        xhr: false
      });
      userController.sendMessage(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/user/messages');

      const ProductModel = require('../../models/Product');
      const CategoryModel = require('../../models/Category');
      const AuctionModel = require('../../models/Auction');
      jest.spyOn(ProductModel, 'getFeatured').mockReturnValue([{ images: '[]' }]);
      jest.spyOn(ProductModel, 'getNewArrivals').mockReturnValue([{ images: '[]' }]);
      jest.spyOn(CategoryModel, 'findAll').mockReturnValue([]);
      jest.spyOn(ArtisanProfile, 'getFeatured').mockReturnValue([]);
      jest.spyOn(AuctionModel, 'getEndingSoon').mockReturnValue([{ product_images: '[]' }]);
      pair = createReqRes();
      homeController.index(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalledWith(
        'home/index',
        expect.objectContaining({ title: 'Craftify - Handmade by Local Artisans' })
      );

      jest.spyOn(database, 'getDb').mockImplementation(() => {
        throw new Error('subscribe fail');
      });
      pair = createReqRes({ body: { email: 'valid@test.com' } });
      homeController.subscribe(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalled();

      // Keep Shipment required and touched for consistency with order controller imports.
      expect(typeof Shipment.findByOrderId).toBe('function');
    });
};
