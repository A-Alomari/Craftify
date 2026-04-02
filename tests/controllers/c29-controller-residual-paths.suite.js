module.exports = ({ createReqRes, getIds }) => {
    test('Controller residual branch paths are covered', () => {
      const ids = getIds();
      const adminController = require('../../controllers/adminController');
      const artisanController = require('../../controllers/artisanController');
      const auctionController = require('../../controllers/auctionController');
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
      const Notification = require('../../models/Notification');
      const Message = require('../../models/Message');
      const Shipment = require('../../models/Shipment');
      const database = require('../../config/database');

      let pair;

      jest.spyOn(User, 'findAll').mockReturnValue([]);
      jest.spyOn(User, 'count').mockReturnValue(0);
      pair = createReqRes({ query: {}, session: { user: { id: ids.adminId, role: 'admin' } } });
      adminController.users(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      const updateStatusSpy = jest.spyOn(User, 'updateStatus').mockReturnValue(true);
      pair = createReqRes({ params: { id: String(ids.custId) }, body: { status: 'active' }, xhr: true });
      adminController.updateUserStatus(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: true });

      updateStatusSpy.mockImplementation(() => {
        throw new Error('status fail');
      });
      pair = createReqRes({ params: { id: String(ids.custId) }, body: { status: 'active' } });
      adminController.updateUserStatus(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/users');

      jest.spyOn(User, 'delete').mockReturnValue(true);
      pair = createReqRes({ params: { id: String(ids.cust2Id) }, session: { user: { id: ids.adminId, role: 'admin' } } });
      adminController.deleteUser(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/users');

      jest.spyOn(ArtisanProfile, 'findAll').mockReturnValue([]);
      pair = createReqRes({ query: { approved: 'false' } });
      adminController.artisans(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      pair = createReqRes({ query: { search: 'shop' } });
      adminController.artisans(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Order, 'findById').mockReturnValue({ id: ids.orderId, user_id: ids.custId });
      jest.spyOn(Order, 'getItems').mockReturnValue([
        { images: '["has-image.jpg"]' },
        { images: '[]' }
      ]);
      pair = createReqRes({ params: { id: String(ids.orderId) } });
      adminController.orderDetail(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Auction, 'findAll').mockReturnValue([
        { product_images: '["one.jpg"]' },
        { product_images: '[]' }
      ]);
      pair = createReqRes({ query: { status: 'active' } });
      adminController.auctions(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Coupon, 'create').mockReturnValue({ id: 1 });
      pair = createReqRes({
        body: {
          code: 'MAX15',
          description: 'Max branch',
          discount_type: 'percent',
          discount_value: '15',
          min_purchase: '25',
          max_discount: '30',
          valid_from: '',
          valid_until: '',
          usage_limit: '3'
        }
      });
      adminController.createCoupon(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/admin/coupons');

      const artisanUserUpdateSpy = jest.spyOn(User, 'update').mockReturnValue(true);
      jest.spyOn(ArtisanProfile, 'update').mockReturnValue(true);
      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        body: { shop_name: 'Shop', bio: 'Bio', return_policy: 'Policy' }
      });
      artisanController.updateProfile(pair.req, pair.res);
      expect(artisanUserUpdateSpy).not.toHaveBeenCalled();

      const productCreateSpy = jest.spyOn(Product, 'create').mockReturnValue({ id: 1 });
      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        body: {
          name: 'Stock Zero Product',
          description: 'desc',
          price: '12',
          stock: '',
          category_id: ''
        }
      });
      artisanController.createProduct(pair.req, pair.res);
      expect(productCreateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ stock: 0, category_id: null })
      );

      const productFindSpy = jest.spyOn(Product, 'findById').mockReturnValue({
        id: ids.vaseId,
        artisan_id: ids.artId,
        images: '["existing.jpg"]'
      });
      const productUpdateSpy = jest.spyOn(Product, 'update').mockReturnValue(true);
      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        params: { id: String(ids.vaseId) },
        body: {
          name: 'Update Product',
          description: 'desc',
          price: '15',
          stock: '',
          category_id: ''
        }
      });
      artisanController.updateProduct(pair.req, pair.res);
      expect(productUpdateSpy).toHaveBeenCalledWith(
        String(ids.vaseId),
        expect.objectContaining({ stock: 0, category_id: null })
      );

      productFindSpy.mockReturnValueOnce(null);
      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        params: { id: String(ids.vaseId) },
        xhr: true
      });
      artisanController.deleteProduct(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: false, message: 'Product not found' });

      productFindSpy.mockReturnValueOnce({ id: ids.vaseId, artisan_id: ids.artId });
      const productDeleteSpy = jest.spyOn(Product, 'delete').mockImplementation(() => {
        throw new Error('delete fail');
      });
      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        params: { id: String(ids.vaseId) },
        xhr: true
      });
      artisanController.deleteProduct(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: false, message: 'Error deleting product' });
      productDeleteSpy.mockRestore();

      jest.spyOn(Order, 'getItemsByArtisan').mockReturnValue([
        { images: '["item.jpg"]' },
        { images: '[]' }
      ]);
      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        params: { id: String(ids.orderId) }
      });
      artisanController.orderDetail(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Auction, 'findAll').mockReturnValue([
        { product_images: '["auction.jpg"]' },
        { product_images: '[]' }
      ]);
      pair = createReqRes({ session: { user: { id: ids.artId, role: 'artisan' } } });
      artisanController.auctions(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Product, 'findById').mockReturnValue({ id: ids.vaseId, artisan_id: ids.artId });
      const auctionCreateSpy = jest.spyOn(Auction, 'create').mockReturnValue({ id: 1 });
      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        body: {
          product_id: ids.vaseId,
          title: 'Auction Reserve',
          description: 'desc',
          starting_bid: '20',
          reserve_price: '30',
          bid_increment: '2',
          start_time: new Date(Date.now() - 60000).toISOString(),
          end_time: new Date(Date.now() + 3600000).toISOString()
        }
      });
      artisanController.createAuction(pair.req, pair.res);
      expect(auctionCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ reserve_price: 30 }));

      pair = createReqRes({
        session: { user: { id: ids.artId, role: 'artisan' } },
        body: {
          product_id: ids.vaseId,
          title: 'Auction Increment Fallback',
          description: 'desc',
          starting_bid: '20',
          reserve_price: '30',
          bid_increment: '',
          start_time: new Date(Date.now() - 60000).toISOString(),
          end_time: new Date(Date.now() + 3600000).toISOString()
        }
      });
      artisanController.createAuction(pair.req, pair.res);
      expect(auctionCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ bid_increment: 1 }));

      jest.spyOn(Auction, 'findAll').mockReturnValue([
        { product_images: '["auction-a.jpg"]' },
        { product_images: '[]' }
      ]);
      jest.spyOn(Auction, 'count').mockReturnValue(2);
      pair = createReqRes({ query: {} });
      auctionController.index(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Auction, 'findById').mockReturnValue({
        id: ids.auctionId,
        title: '',
        product_name: 'Product Name Fallback',
        product_images: '["detail.jpg"]',
        end_time: new Date(Date.now() + 60000).toISOString(),
        status: 'active'
      });
      jest.spyOn(Auction, 'getBids').mockReturnValue([{ user_id: ids.custId, amount: 22 }]);
      pair = createReqRes({
        params: { id: String(ids.auctionId) },
        session: { user: { id: ids.custId, role: 'customer' } }
      });
      auctionController.show(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      const outbidSpy = jest.spyOn(Notification, 'auctionOutbid').mockReturnValue(true);
      const bidEmit = jest.fn();
      const io = { to: jest.fn(() => ({ emit: bidEmit })) };
      jest.spyOn(Auction, 'placeBid').mockReturnValue({
        previousBidderId: ids.cust2Id,
        bid: { amount: 33, created_at: new Date().toISOString() },
        auction: { bid_count: 3, title: '', product_name: 'Fallback Name' }
      });
      pair = createReqRes({
        params: { id: String(ids.auctionId) },
        body: { amount: 33 },
        xhr: true,
        session: { user: { id: ids.custId, name: 'Customer' } },
        app: { get: jest.fn(() => io) }
      });
      auctionController.placeBid(pair.req, pair.res);
      expect(outbidSpy).toHaveBeenCalled();
      expect(pair.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

      jest.spyOn(Auction, 'getUserBids').mockReturnValue([
        { product_images: '["bid-one.jpg"]', winner_id: ids.custId },
        { product_images: '[]', winner_id: ids.cust2Id }
      ]);
      pair = createReqRes({ session: { user: { id: ids.custId } } });
      auctionController.myBids(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Product, 'findAll').mockReturnValue([{ id: ids.vaseId, images: '["p.jpg"]' }]);
      jest.spyOn(Product, 'count').mockReturnValue(1);
      jest.spyOn(Category, 'findAll').mockReturnValue([]);
      pair = createReqRes({ query: {} });
      productController.index(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Product, 'findById').mockReturnValue({
        id: ids.vaseId,
        status: 'approved',
        artisan_id: ids.artId,
        images: '["show.jpg"]',
        name: 'Product'
      });
      jest.spyOn(Product, 'incrementViews').mockReturnValue(true);
      jest.spyOn(Review, 'findByProductId').mockReturnValue([]);
      jest.spyOn(Review, 'getAverageRating').mockReturnValue({ average: 0, count: 0 });
      jest.spyOn(Review, 'getRatingDistribution').mockReturnValue([]);
      jest.spyOn(Product, 'getRelated').mockReturnValue([]);
      jest.spyOn(ArtisanProfile, 'findByUserId').mockReturnValue({ id: ids.artId, shop_name: 'Shop' });
      jest.spyOn(Review, 'canReview').mockReturnValue({ canReview: true });
      pair = createReqRes({ params: { id: String(ids.vaseId) } });
      productController.show(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      pair = createReqRes({ query: {} });
      productController.search(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/products?search=');

      jest.spyOn(Cart, 'getItems').mockReturnValue([
        { images: '["cart.jpg"]' },
        { images: '[]' }
      ]);
      jest.spyOn(Cart, 'getTotal').mockReturnValue({ total: 120, item_count: 2 });
      jest.spyOn(Coupon, 'validate').mockReturnValue({ valid: true, discount: 10, coupon: { code: 'TEST10', description: 'd' } });
      pair = createReqRes({ session: { user: { id: ids.custId }, appliedCoupon: { code: 'TEST10' } } });
      cartController.index(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      pair = createReqRes({ session: { user: null, appliedCoupon: null }, sessionID: 'guest-one' });
      Cart.getItems.mockReturnValue([{ images: '[]' }]);
      Cart.getTotal.mockReturnValue({ total: 20, item_count: 1 });
      cartController.index(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Product, 'findById').mockReturnValue({ id: ids.vaseId, status: 'approved', stock: 10 });
      jest.spyOn(Cart, 'addItem').mockReturnValue(true);
      jest.spyOn(Cart, 'getCount').mockReturnValue(3);
      pair = createReqRes({ body: { productId: ids.vaseId }, session: { user: null }, sessionID: 'guest-add', get: jest.fn(() => undefined) });
      cartController.addItem(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/products');

      jest.spyOn(Product, 'findById').mockImplementation(() => {
        throw new Error('xhr add fail');
      });
      pair = createReqRes({ body: { productId: ids.vaseId, quantity: 1 }, xhr: true });
      cartController.addItem(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: false, message: 'Error adding to cart' });

      jest.spyOn(Product, 'findById').mockReturnValue({ id: ids.vaseId, status: 'approved', stock: 10 });
      jest.spyOn(Cart, 'updateItemQuantity').mockReturnValue(true);
      jest.spyOn(Cart, 'getTotal').mockReturnValue({ total: 30, item_count: 2 });
      pair = createReqRes({ body: { productId: ids.vaseId, quantity: 2 }, session: { user: null }, sessionID: 'guest-update' });
      cartController.updateItem(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      jest.spyOn(Product, 'findById').mockImplementation(() => {
        throw new Error('update xhr fail');
      });
      pair = createReqRes({ body: { productId: ids.vaseId, quantity: 1 }, xhr: true });
      cartController.updateItem(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: false, message: 'Error updating cart' });

      jest.spyOn(Cart, 'removeItem').mockReturnValue(true);
      pair = createReqRes({ body: { productId: ids.vaseId }, session: { user: null }, sessionID: 'guest-remove' });
      cartController.removeItem(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      jest.spyOn(Cart, 'removeItem').mockImplementation(() => {
        throw new Error('remove xhr fail');
      });
      pair = createReqRes({ body: { productId: ids.vaseId }, xhr: true });
      cartController.removeItem(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: false, message: 'Error removing item' });

      jest.spyOn(Cart, 'getTotal').mockReturnValue({ total: 70, item_count: 1 });
      jest.spyOn(Coupon, 'validate').mockReturnValue({ valid: true, discount: 7, coupon: { code: 'TEST10', description: 'desc' } });
      pair = createReqRes({ body: { code: 'TEST10' }, session: { user: null }, sessionID: 'guest-coupon' });
      cartController.applyCoupon(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      jest.spyOn(Cart, 'getTotal').mockImplementation(() => {
        throw new Error('coupon xhr fail');
      });
      pair = createReqRes({ body: { code: 'TEST10' }, xhr: true });
      cartController.applyCoupon(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: false, message: 'Error applying coupon' });

      jest.spyOn(Cart, 'clear').mockReturnValue(true);
      pair = createReqRes({ session: { user: null, appliedCoupon: { code: 'TEST10' } }, sessionID: 'guest-clear' });
      cartController.clear(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      jest.spyOn(Product, 'getFeatured').mockReturnValue([{ images: '["featured.jpg"]' }, { images: '[]' }]);
      jest.spyOn(Product, 'getNewArrivals').mockReturnValue([{ images: '["new.jpg"]' }, { images: '[]' }]);
      jest.spyOn(Category, 'findAll').mockReturnValue([]);
      jest.spyOn(ArtisanProfile, 'getFeatured').mockReturnValue([]);
      jest.spyOn(Auction, 'getEndingSoon').mockReturnValue([{ product_images: '["ending.jpg"]' }, { product_images: '[]' }]);
      pair = createReqRes();
      homeController.index(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Cart, 'getItems').mockReturnValue([{ images: '["checkout.jpg"]' }, { images: '[]' }]);
      jest.spyOn(Cart, 'validateItems').mockReturnValue([{ name: 'Out', available: 0 }]);
      pair = createReqRes({ session: { user: { id: ids.custId } } });
      orderController.placeOrder(pair.req, pair.res);
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      Cart.getItems.mockReturnValue([{ images: '["checkout.jpg"]' }]);
      Cart.validateItems.mockReturnValue([]);
      Cart.getTotal.mockReturnValue({ total: 10, item_count: 1 });
      Coupon.validate.mockReturnValue({ valid: true, discount: 2, coupon: { code: 'TEST10', description: 'd' } });
      const dbMock = { transaction: jest.fn() };
      jest.spyOn(database, 'getDb').mockReturnValue(dbMock);
      jest.spyOn(Order, 'create').mockImplementation(() => {
        throw new Error('tx fail');
      });
      pair = createReqRes({
        session: { user: { id: ids.custId }, appliedCoupon: { code: 'TEST10' } },
        body: {
          shipping_address: 'Road 1',
          shipping_city: 'Manama',
          payment_method: 'cash',
          shipping_country: ''
        }
      });
      orderController.placeOrder(pair.req, pair.res);
      expect(dbMock.transaction).toHaveBeenCalledWith('ROLLBACK');
      expect(pair.res.redirect).toHaveBeenCalledWith('/cart');

      jest.spyOn(Order, 'findById').mockReturnValue({ id: ids.orderId, user_id: ids.custId });
      jest.spyOn(Order, 'getItems').mockReturnValue([{ images: '["order.jpg"]' }, { images: '[]' }]);
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
      orderController.track(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      Cart.getItems.mockReturnValue([{ images: null, product_id: ids.vaseId, artisan_id: ids.artId, quantity: 1, price: 10 }]);
      Cart.validateItems.mockReturnValue([]);
      Cart.getTotal.mockReturnValue({ total: 20, item_count: 1 });
      Coupon.validate.mockReturnValue({ valid: true, discount: 4, coupon: { code: 'TEST10', description: 'd' } });
      pair = createReqRes({ session: { user: { id: ids.custId }, appliedCoupon: { code: 'TEST10' } } });
      orderController.checkout(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Coupon, 'use').mockReturnValue(true);
      pair = createReqRes({
        session: { user: { id: ids.custId }, appliedCoupon: { code: 'TEST10' } },
        body: {
          shipping_address: '',
          shipping_city: '',
          payment_method: 'cash'
        }
      });
      orderController.placeOrder(pair.req, pair.res);
      expect(Coupon.use).not.toHaveBeenCalled();
      expect(pair.res.redirect).toHaveBeenCalledWith('/orders/checkout');

      jest.spyOn(require('../../models/Wishlist'), 'findByUserId').mockReturnValue([
        { images: '["wish.jpg"]' },
        { images: '[]' }
      ]);
      pair = createReqRes({ session: { user: { id: ids.custId } } });
      userController.wishlist(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(require('../../models/Wishlist'), 'add').mockReturnValue(true);
      pair = createReqRes({ session: { user: { id: ids.custId } }, body: { productId: ids.vaseId }, xhr: true });
      userController.addToWishlist(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: true, added: true });

      jest.spyOn(require('../../models/Wishlist'), 'remove').mockReturnValue(true);
      pair = createReqRes({ session: { user: { id: ids.custId } }, body: { productId: ids.vaseId }, xhr: true });
      userController.removeFromWishlist(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: true });

      jest.spyOn(require('../../models/Wishlist'), 'toggle').mockReturnValue(true);
      pair = createReqRes({ session: { user: { id: ids.custId } }, body: { productId: ids.vaseId }, xhr: true });
      userController.toggleWishlist(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: true, inWishlist: true });

      jest.spyOn(require('../../models/Wishlist'), 'moveToCart').mockReturnValue(true);
      pair = createReqRes({ session: { user: { id: ids.custId } }, body: { productId: ids.vaseId }, xhr: true });
      userController.moveToCart(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: true });

      jest.spyOn(Review, 'findByUserId').mockReturnValue([
        { images: '["review.jpg"]' },
        { images: '[]' }
      ]);
      pair = createReqRes({ session: { user: { id: ids.custId } } });
      userController.reviews(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(Review, 'canReview').mockReturnValue({ canReview: false });
      pair = createReqRes({ session: { user: { id: ids.custId } }, body: { product_id: ids.vaseId }, xhr: true });
      userController.createReview(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: false, message: 'You cannot review this product' });

      jest.spyOn(Review, 'canReview').mockReturnValue({ canReview: true });
      jest.spyOn(Review, 'create').mockReturnValue({ id: 1 });
      jest.spyOn(Product, 'findById').mockReturnValue({ artisan_id: ids.artId, name: 'Prod' });
      jest.spyOn(Notification, 'newReview').mockReturnValue(true);
      pair = createReqRes({
        session: { user: { id: ids.custId } },
        body: {
          product_id: ids.vaseId,
          rating: 5,
          title: 'Great',
          comment: 'Great product'
        },
        xhr: true
      });
      userController.createReview(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

      jest.spyOn(Review, 'findById').mockReturnValue(null);
      pair = createReqRes({ params: { id: '1' }, session: { user: { id: ids.custId } }, xhr: true });
      userController.deleteReview(pair.req, pair.res);
      expect(pair.res.json).toHaveBeenCalledWith({ success: false, message: 'Review not found' });

      jest.spyOn(Message, 'getThread').mockReturnValue([]);
      jest.spyOn(User, 'findById').mockReturnValue({ id: ids.artId, role: 'artisan', name: 'Artisan User' });
      jest.spyOn(Message, 'markThreadAsRead').mockReturnValue(true);
      jest.spyOn(ArtisanProfile, 'findByUserId').mockReturnValue({ shop_name: 'Shop' });
      pair = createReqRes({ session: { user: { id: ids.custId } }, params: { userId: String(ids.artId) } });
      userController.conversation(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();

      jest.spyOn(ArtisanProfile, 'findByUserId').mockReturnValue({ is_approved: true, shop_name: 'Shop' });
      jest.spyOn(Product, 'findAll').mockReturnValue([{ images: '["artisan.jpg"]' }, { images: '[]' }]);
      jest.spyOn(ArtisanProfile, 'getStats').mockReturnValue({});
      jest.spyOn(Review, 'findAll').mockReturnValue([]);
      pair = createReqRes({ params: { id: String(ids.artId) } });
      userController.viewArtisan(pair.req, pair.res);
      expect(pair.res.render).toHaveBeenCalled();
    });
};
