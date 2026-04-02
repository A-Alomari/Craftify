module.exports = ({ createReqRes, getIds }) => {
    test('Remaining non-server single-line branches are covered', async () => {
      const ids = getIds();
      const request = require('supertest');
      const express = require('express');

      const adminController = require('../../controllers/adminController');
      const artisanController = require('../../controllers/artisanController');
      const auctionController = require('../../controllers/auctionController');
      const authController = require('../../controllers/authController');
      const cartController = require('../../controllers/cartController');
      const homeController = require('../../controllers/homeController');
      const orderController = require('../../controllers/orderController');
      const productController = require('../../controllers/productController');
      const userController = require('../../controllers/userController');

      const User = require('../../models/User');
      const ArtisanProfile = require('../../models/ArtisanProfile');
      const Product = require('../../models/Product');
      const Category = require('../../models/Category');
      const Order = require('../../models/Order');
      const Auction = require('../../models/Auction');
      const Review = require('../../models/Review');
      const Coupon = require('../../models/Coupon');
      const Cart = require('../../models/Cart');
      const Wishlist = require('../../models/Wishlist');
      const Notification = require('../../models/Notification');
      const Message = require('../../models/Message');
      const Shipment = require('../../models/Shipment');
      const database = require('../../config/database');

      let pair;

      jest.spyOn(Order, 'findById').mockReturnValue({ id: ids.orderId, user_id: ids.custId });
      jest.spyOn(Order, 'getItems').mockReturnValue([{ images: null }]);
      pair = createReqRes({ params: { id: String(ids.orderId) } });
      adminController.orderDetail(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Auction, 'findAll').mockReturnValue([{ product_images: null }]);
      pair = createReqRes({ query: {} });
      adminController.auctions(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Product, 'findById').mockReturnValue({ id: ids.vaseId, artisan_id: ids.artId, images: null });
      jest.spyOn(Category, 'findAll').mockReturnValue([]);
      pair = createReqRes({ session: { user: { id: ids.artId, role: 'artisan' } }, params: { id: String(ids.vaseId) } });
      artisanController.editProduct(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Product, 'update').mockReturnValue(true);
      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        params: { id: String(ids.vaseId) },
        body: {
          name: 'Update Null Images',
          description: 'desc',
          price: '10',
          stock: '2',
          category_id: String(ids.potId)
        }
      });
      artisanController.updateProduct(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/artisan/products');

      jest.spyOn(Order, 'getItemsByArtisan').mockReturnValue([{ images: null }]);
      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        params: { id: String(ids.orderId) }
      });
      artisanController.orderDetail(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Auction, 'findAll').mockReturnValue([{ product_images: null }]);
      pair = createReqRes({ session: { user: { id: ids.artId, role: 'artisan' } } });
      artisanController.auctions(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Product, 'findById').mockReturnValue({ id: ids.vaseId, artisan_id: ids.artId });
      const createAuctionSpy = jest.spyOn(Auction, 'create').mockReturnValue({ id: 1 });
      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        body: {
          product_id: ids.vaseId,
          title: 'No Reserve Branch',
          description: 'desc',
          starting_bid: '12',
          reserve_price: '',
          bid_increment: '1',
          start_time: new Date(Date.now() - 60000).toISOString(),
          end_time: new Date(Date.now() + 3600000).toISOString()
        }
      });
      artisanController.createAuction(pair.req, pair.res);
      expect(createAuctionSpy).toHaveBeenCalledWith(expect.objectContaining({ reserve_price: null }));

      jest.spyOn(Auction, 'findAll').mockReturnValue([{ product_images: null }]);
      jest.spyOn(Auction, 'count').mockReturnValue(1);
      pair = createReqRes({ query: {} });
      auctionController.index(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Auction, 'findById').mockReturnValue({
        id: ids.auctionId,
        title: 'Title',
        product_name: 'Product',
        product_images: null,
        end_time: new Date(Date.now() + 60000).toISOString(),
        status: 'active'
      });
      jest.spyOn(Auction, 'getBids').mockReturnValue([]);
      pair = createReqRes({ params: { id: String(ids.auctionId) } });
      auctionController.show(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Auction, 'getUserBids').mockReturnValue([{ product_images: null, winner_id: ids.custId }]);
      pair = createReqRes({ session: { user: { id: ids.custId } } });
      auctionController.myBids(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(User, 'verifyPassword').mockResolvedValue({
        id: ids.custId,
        email: 'customer@test.com',
        name: 'Customer',
        role: 'customer',
        status: 'active'
      });
      jest.spyOn(Cart, 'mergeGuestCart').mockReturnValue(true);
      pair = createReqRes({ body: { email: '', password: '' } });
      await authController.login(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/login');

      pair = createReqRes({ body: { email: 'customer@test.com', password: 'cust123' }, sessionID: undefined });
      await authController.login(pair.req, pair.res);
      expect(Cart.mergeGuestCart).not.toHaveBeenCalled();

      jest.spyOn(User, 'create').mockResolvedValue({ id: ids.artId });
      jest.spyOn(ArtisanProfile, 'create').mockReturnValue({ id: 1 });
      jest.spyOn(Notification, 'create').mockReturnValue({ id: 1 });
      pair = createReqRes({
        body: {
          name: 'Auth Artisan',
          email: 'auth-artisan@test.com',
          password: 'artisan123',
          confirm_password: 'artisan123',
          shop_name: 'Shop',
          bio: '',
          return_policy: ''
        },
        file: { filename: 'auth-profile.png' }
      });
      await authController.registerArtisan(pair.req, pair.res);
      expect(ArtisanProfile.create).toHaveBeenCalledWith(expect.objectContaining({ bio: '', return_policy: '' }));

      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      jest.spyOn(User, 'findByEmail').mockReturnValue({ id: ids.custId, email: 'customer@test.com', name: 'Customer' });
      jest.spyOn(database, 'getDb').mockReturnValue({ prepare: () => ({ run: jest.fn() }) });
      pair = createReqRes({ body: { email: 'customer@test.com' } });
      await authController.forgotPassword(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/auth/forgot-password');
      process.env.NODE_ENV = originalNodeEnv;

      jest.spyOn(Cart, 'getItems').mockReturnValue([{ images: null }]);
      jest.spyOn(Cart, 'getTotal').mockReturnValue({ total: 40, item_count: 1 });
      jest.spyOn(Coupon, 'validate').mockReturnValue({ valid: true, discount: 5, coupon: { code: 'X', description: 'd' } });
      pair = createReqRes({ session: { user: { id: ids.custId }, appliedCoupon: { code: 'X' } } });
      cartController.index(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Product, 'getFeatured').mockReturnValue([{ images: null }]);
      jest.spyOn(Product, 'getNewArrivals').mockReturnValue([{ images: null }]);
      jest.spyOn(Category, 'findAll').mockReturnValue([]);
      jest.spyOn(ArtisanProfile, 'getFeatured').mockReturnValue([]);
      jest.spyOn(Auction, 'getEndingSoon').mockReturnValue([{ product_images: null }]);
      pair = createReqRes();
      homeController.index(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Cart, 'getItems').mockReturnValue([{ images: null }]);
      jest.spyOn(Cart, 'validateItems').mockReturnValue([]);
      jest.spyOn(Cart, 'getTotal').mockReturnValue({ total: 20, item_count: 1 });
      jest.spyOn(Coupon, 'validate').mockReturnValue({ valid: true, discount: 3, coupon: { code: 'TEST10', description: 'd' } });
      pair = createReqRes({ session: { user: { id: ids.custId }, appliedCoupon: { code: 'TEST10' } } });
      orderController.checkout(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      const dbTxMock = { transaction: jest.fn(() => { throw new Error('begin fail'); }) };
      jest.spyOn(database, 'getDb').mockReturnValue(dbTxMock);
      pair = createReqRes({
        session: { user: { id: ids.custId }, appliedCoupon: null },
        body: {
          shipping_address: 'Road 1',
          shipping_city: 'Manama',
          payment_method: 'cash',
          shipping_country: 'Bahrain'
        }
      });
      orderController.placeOrder(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      jest.spyOn(Order, 'findById').mockReturnValue({ id: ids.orderId, user_id: ids.custId });
      jest.spyOn(Order, 'getItems').mockReturnValue([{ images: null }]);
      jest.spyOn(Shipment, 'findByOrderId').mockReturnValue({ id: 1 });
      jest.spyOn(Shipment, 'getHistory').mockReturnValue([{ status: 'shipped' }]);
      pair = createReqRes({ params: { id: String(ids.orderId) }, session: { user: { id: ids.custId } } });
      orderController.confirmation(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      pair = createReqRes({ params: { id: String(ids.orderId) }, session: { user: { id: ids.custId } } });
      orderController.show(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      Shipment.findByOrderId.mockReturnValue(null);
      pair = createReqRes({ params: { id: String(ids.orderId) }, session: { user: { id: ids.custId } } });
      orderController.show(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      Shipment.findByOrderId.mockReturnValue({ id: 1 });
      pair = createReqRes({ params: { id: String(ids.orderId) }, session: { user: { id: ids.custId } } });
      orderController.track(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Product, 'findById').mockReturnValue({
        id: ids.vaseId,
        status: 'approved',
        artisan_id: ids.artId,
        images: null,
        name: 'Product'
      });
      jest.spyOn(Product, 'incrementViews').mockReturnValue(true);
      jest.spyOn(Review, 'findByProductId').mockReturnValue([]);
      jest.spyOn(Review, 'getAverageRating').mockReturnValue({ average: 0, count: 0 });
      jest.spyOn(Review, 'getRatingDistribution').mockReturnValue([]);
      jest.spyOn(Product, 'getRelated').mockReturnValue([]);
      jest.spyOn(ArtisanProfile, 'findByUserId').mockReturnValue({ id: ids.artId, shop_name: 'Shop' });
      pair = createReqRes({ params: { id: String(ids.vaseId) } });
      productController.show(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Wishlist, 'findByUserId').mockReturnValue([{ images: null }]);
      pair = createReqRes({ session: { user: { id: ids.custId } } });
      userController.wishlist(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Wishlist, 'add').mockImplementation(() => {
        throw new Error('add fallback');
      });
      pair = createReqRes({
        session: { user: { id: ids.custId } },
        body: { productId: ids.vaseId },
        xhr: false,
        get: jest.fn(() => undefined)
      });
      userController.addToWishlist(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/products');

      jest.spyOn(Wishlist, 'toggle').mockImplementation(() => {
        throw new Error('toggle fallback');
      });
      pair = createReqRes({
        session: { user: { id: ids.custId } },
        body: { productId: ids.vaseId },
        xhr: false,
        get: jest.fn(() => undefined)
      });
      userController.toggleWishlist(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/products');

      jest.spyOn(Review, 'findByUserId').mockReturnValue([{ images: null }]);
      pair = createReqRes({ session: { user: { id: ids.custId } } });
      userController.reviews(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Review, 'canReview').mockReturnValue({ canReview: true });
      jest.spyOn(Review, 'create').mockReturnValue({ id: 9 });
      jest.spyOn(Product, 'findById').mockReturnValue(null);
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
      expect(pair.res.redirect).toHaveBeenCalledWith(`/products/${ids.vaseId}`);

      jest.spyOn(Review, 'create').mockImplementation(() => {
        throw {};
      });
      pair = createReqRes({
        session: { user: { id: ids.custId } },
        body: {
          product_id: ids.vaseId,
          rating: 5,
          title: 'Title',
          comment: 'Comment'
        },
        xhr: false,
        get: jest.fn(() => '/products')
      });
      userController.createReview(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/products');

      jest.spyOn(Review, 'create').mockImplementation(() => {
        throw new Error('explicit review failure');
      });
      pair = createReqRes({
        session: { user: { id: ids.custId } },
        body: {
          product_id: ids.vaseId,
          rating: 5,
          title: 'Title',
          comment: 'Comment'
        },
        xhr: false,
        get: jest.fn(() => '/custom-ref')
      });
      userController.createReview(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/custom-ref');

      jest.spyOn(User, 'findById').mockReturnValue({ id: ids.custId, role: 'customer', name: 'Customer' });
      jest.spyOn(Message, 'markThreadAsRead').mockReturnValue(true);
      jest.spyOn(Message, 'getThread').mockReturnValue([]);
      pair = createReqRes({ session: { user: { id: ids.custId } }, params: { userId: String(ids.cust2Id) } });
      userController.conversation(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(ArtisanProfile, 'findByUserId').mockReturnValue({ is_approved: true, shop_name: 'Shop' });
      jest.spyOn(Product, 'findAll').mockReturnValue([{ images: null }]);
      jest.spyOn(ArtisanProfile, 'getStats').mockReturnValue({});
      jest.spyOn(Review, 'findAll').mockReturnValue([]);
      pair = createReqRes({ params: { id: String(ids.artId) } });
      userController.viewArtisan(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

    }, 20000);
};
