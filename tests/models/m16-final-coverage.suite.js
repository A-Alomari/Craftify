module.exports = ({ getTestContext }) => {
  let db;
  let ids;

  function uniqueValue(prefix) {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  beforeAll(() => {
    ({ db, ids } = getTestContext());
  });

  describe('Final Database and Model Coverage Branches', () => {
    const Product = require('../../models/Product');
    const User = require('../../models/User');
    const Category = require('../../models/Category');
    const ArtisanProfile = require('../../models/ArtisanProfile');
    const Auction = require('../../models/Auction');
    const Cart = require('../../models/Cart');
    const Coupon = require('../../models/Coupon');
    const Notification = require('../../models/Notification');
    const Order = require('../../models/Order');
    const Review = require('../../models/Review');
    const Shipment = require('../../models/Shipment');
    const Wishlist = require('../../models/Wishlist');

    test('database module fallback path and undefined parameter mapping are covered', async () => {
      const fs = require('fs');
      const path = require('path');
      const originalPath = process.env.CRAFTIFY_DB_PATH;

      let defaultDbModule;
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});

      try {
        jest.isolateModules(() => {
          delete process.env.CRAFTIFY_DB_PATH;
          defaultDbModule = require('../../config/database');
        });

        await defaultDbModule.initDatabase();
        const getWithUndefined = defaultDbModule.getDb().prepare('SELECT ? as value').get(undefined);
        expect(getWithUndefined.value).toBeNull();

        const allWithUndefined = defaultDbModule.getDb().prepare('SELECT ? as value').all(undefined);
        expect(allWithUndefined[0].value).toBeNull();
      } finally {
        writeSpy.mockRestore();
        if (originalPath === undefined) {
          delete process.env.CRAFTIFY_DB_PATH;
        } else {
          process.env.CRAFTIFY_DB_PATH = originalPath;
        }
        try {
          fs.unlinkSync(path.join(__dirname, '..', '..', 'craftify.db'));
        } catch (e) {
          // Ignore cleanup failures.
        }
      }
    });

    test('product, user, category, and artisan profile remaining branches are covered', async () => {
      Product.findAll();

      const createdProduct = Product.create({
        artisan_id: ids.artId,
        category_id: ids.potId,
        name: uniqueValue('Default product'),
        description: 'Default product for branch coverage',
        price: 19
      });
      expect(createdProduct).toBeTruthy();

      expect(Product.update(createdProduct.id, { id: createdProduct.id, unknown_field: 'x' })).toBeNull();
      expect(Array.isArray(Product.getFeatured())).toBe(true);
      expect(Array.isArray(Product.getNewArrivals())).toBe(true);
      expect(Array.isArray(Product.getPopular())).toBe(true);
      expect(Array.isArray(Product.getByArtisan(ids.artId))).toBe(true);
      expect(Product.getRelated(99999999)).toEqual([]);

      Product.delete(createdProduct.id);

      expect(Array.isArray(User.findAll())).toBe(true);
      expect(Array.isArray(User.findAll({ role: 'customer', status: 'active', search: 'Customer', limit: 1 }))).toBe(true);

      const defaultUserEmail = `${uniqueValue('default_user')}@test.com`;
      const defaultUser = await User.create({
        name: 'Default Role User',
        email: defaultUserEmail,
        password: 'pass1234'
      });
      expect(defaultUser.role).toBe('customer');

      const missingUserLogin = await User.verifyPassword(`${uniqueValue('missing')}@test.com`, 'pass1234');
      expect(missingUserLogin).toBeNull();

      expect(User.update(defaultUser.id, { id: defaultUser.id, password: 'ignored' })).toBeNull();

      const originalPrepare = db.prepare.bind(db);
      db.prepare = (sql) => {
        if (typeof sql === 'string' && sql.includes('COUNT(*) as count FROM users')) {
          return { get: () => undefined };
        }
        return originalPrepare(sql);
      };
      expect(User.count()).toBe(0);
      db.prepare = originalPrepare;

      User.delete(defaultUser.id);

      const createdCategory = Category.create({ name: uniqueValue('Branch Category') });
      expect(createdCategory).toBeTruthy();
      expect(Category.update(createdCategory.id, { id: createdCategory.id })).toBeNull();
      expect(Category.update(createdCategory.id, {})).toBeNull();
      expect(Array.isArray(Category.getWithProducts())).toBe(true);
      Category.delete(createdCategory.id);

      expect(Array.isArray(ArtisanProfile.findAll({ status: 'active', approved: true, search: 'Test', limit: 2 }))).toBe(true);

      const artisanEmail = `${uniqueValue('artisan_branch')}@test.com`;
      const artisanUserId = db
        .prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)')
        .run('Branch Artisan', artisanEmail, 'hash', 'artisan', 'active').lastInsertRowid;

      const createdProfile = ArtisanProfile.create({
        user_id: artisanUserId,
        shop_name: uniqueValue('Branch Shop')
      });
      expect(createdProfile).toBeTruthy();
      expect(ArtisanProfile.update(artisanUserId, { id: 1, user_id: 1 })).toBeNull();
      expect(Array.isArray(ArtisanProfile.getFeatured())).toBe(true);
      expect(typeof ArtisanProfile.count({ approved: false })).toBe('number');

      const profilePrepare = db.prepare.bind(db);
      db.prepare = (sql) => {
        if (typeof sql === 'string' && sql.includes('total_products')) {
          return { get: () => undefined };
        }
        return profilePrepare(sql);
      };
      const fallbackStats = ArtisanProfile.getStats(ids.artId);
      expect(fallbackStats.total_products).toBe(0);
      db.prepare = profilePrepare;

      db.prepare('DELETE FROM users WHERE id = ?').run(artisanUserId);

      expect(Array.isArray(ArtisanProfile.findAll())).toBe(true);
      expect(typeof ArtisanProfile.count()).toBe('number');

      const artisanCountPrepare = db.prepare.bind(db);
      db.prepare = (sql) => {
        if (typeof sql === 'string' && sql.includes('COUNT(*) as count FROM artisan_profiles')) {
          return { get: () => undefined };
        }
        return artisanCountPrepare(sql);
      };
      expect(ArtisanProfile.count()).toBe(0);
      db.prepare = artisanCountPrepare;
    });

    test('auction, cart, order, and shipment remaining branches are covered', () => {
      expect(Array.isArray(Auction.findAll({
        status: 'active',
        artisan_id: ids.artId,
        ending_soon: true,
        search: 'Auction',
        sort: 'highest_bid',
        limit: 2,
        offset: 1
      }))).toBe(true);

      const now = Date.now();
      const pendingAuction = Auction.create({
        product_id: ids.vaseId,
        artisan_id: ids.artId,
        starting_bid: 20,
        start_time: new Date(now + 60 * 60 * 1000).toISOString(),
        end_time: new Date(now + 2 * 60 * 60 * 1000).toISOString()
      });
      expect(pendingAuction.status).toBe('pending');

      const auctionPrepare = db.prepare.bind(db);
      db.prepare = (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT name FROM products WHERE id = ?')) {
          return { get: () => undefined };
        }
        return auctionPrepare(sql);
      };
      const titledFallbackAuction = Auction.create({
        product_id: ids.vaseId,
        artisan_id: ids.artId,
        starting_bid: 22,
        start_time: new Date(now - 60 * 60 * 1000).toISOString(),
        end_time: new Date(now + 60 * 60 * 1000).toISOString()
      });
      expect(titledFallbackAuction.title).toBe('Auction');
      db.prepare = auctionPrepare;

      expect(() => Auction.placeBid(99999999, ids.custId, 100)).toThrow('Auction not found');
      expect(() => Auction.placeBid(pendingAuction.id, ids.custId, 50)).toThrow('Auction is not active');

      const endedAuctionId = db.prepare(`
        INSERT INTO auctions (product_id, artisan_id, title, starting_price, current_highest_bid, bid_increment, start_time, end_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(
        ids.vaseId,
        ids.artId,
        uniqueValue('Ended bid auction'),
        30,
        35,
        5,
        new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        new Date(now - 60 * 1000).toISOString()
      ).lastInsertRowid;

      expect(() => Auction.placeBid(endedAuctionId, ids.custId, 50)).toThrow('Auction has ended');
      expect(Array.isArray(Auction.findAll())).toBe(true);
      expect(Array.isArray(Auction.getBids(ids.auctionId))).toBe(true);
      expect(Array.isArray(Auction.getUserBids(ids.custId, 1))).toBe(true);
      expect(Array.isArray(Auction.getActive())).toBe(true);
      expect(Array.isArray(Auction.getEndingSoon())).toBe(true);

      const noCurrentBidAuctionId = db.prepare(`
        INSERT INTO auctions (product_id, artisan_id, title, starting_price, current_highest_bid, bid_increment, start_time, end_time, status)
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'active')
      `).run(
        ids.vaseId,
        ids.artId,
        uniqueValue('No current bid'),
        10,
        2,
        new Date(now - 60 * 60 * 1000).toISOString(),
        new Date(now + 60 * 60 * 1000).toISOString()
      ).lastInsertRowid;
      const placedFromStartingPrice = Auction.placeBid(noCurrentBidAuctionId, ids.cust2Id, 12);
      expect(placedFromStartingPrice.bid).toBeTruthy();

      const zeroCurrentBidAuctionId = db.prepare(`
        INSERT INTO auctions (product_id, artisan_id, title, starting_price, current_highest_bid, bid_increment, start_time, end_time, status)
        VALUES (?, ?, ?, 0, 0, 1, ?, ?, 'active')
      `).run(
        ids.ringId,
        ids.artId,
        uniqueValue('Zero current bid'),
        new Date(now - 60 * 60 * 1000).toISOString(),
        new Date(now + 60 * 60 * 1000).toISOString()
      ).lastInsertRowid;
      const placedFromZero = Auction.placeBid(zeroCurrentBidAuctionId, ids.custId, 1);
      expect(placedFromZero.bid.amount).toBe(1);

      const sessionId = uniqueValue('cart_branch_session');
      Cart.addItem(null, sessionId, ids.vaseId, 1);
      Cart.updateItemQuantity(null, sessionId, ids.vaseId, 0);
      Cart.addItem(null, sessionId, ids.ringId, 1);
      Cart.removeItem(null, sessionId, ids.ringId);
      Cart.addItem(null, sessionId, ids.vaseId, 1);
      Cart.clear(null, sessionId);

      const sessionId2 = uniqueValue('cart_branch_session_2');
      Cart.addItem(undefined, sessionId2, ids.vaseId, 1);
      Cart.updateItemQuantity(undefined, sessionId2, ids.vaseId, 2);
      Cart.removeItem(undefined, sessionId2, ids.vaseId);

      const nullScopedAdd = Cart.addItem(undefined, undefined, ids.vaseId);
      expect(nullScopedAdd).toBeTruthy();
      Cart.updateItemQuantity(undefined, undefined, ids.vaseId, 3);
      Cart.removeItem(undefined, undefined, ids.vaseId);

      Cart.clear();

      expect(Cart.getItems()).toEqual([]);
      expect(Cart.getTotal()).toEqual({ total: 0, item_count: 0 });
      expect(Cart.getCount()).toBeGreaterThanOrEqual(0);
      expect(Cart.getCount(ids.custId)).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(Cart.validateItems())).toBe(true);
      expect(Array.isArray(Cart.validateItems(ids.custId, null))).toBe(true);

      expect(Array.isArray(Order.findAll())).toBe(true);

      const orderWithDefaults = Order.create({
        user_id: ids.cust2Id,
        shipping_address: 'Branch Address',
        shipping_city: 'Manama',
        shipping_postal: '100',
        total_amount: 10,
        subtotal: 10,
        payment_method: 'cash'
      });
      expect(orderWithDefaults.shipping_country).toBe('Bahrain');

      const paymentUpdated = Order.updatePaymentStatus(orderWithDefaults.id, 'paid');
      expect(paymentUpdated.payment_status).toBe('paid');
      expect(paymentUpdated.transaction_ref).toBeNull();

      expect(Array.isArray(Order.getRecentByArtisan(ids.artId))).toBe(true);

      const orderPrepare = db.prepare.bind(db);
      db.prepare = (sql) => {
        if (typeof sql === 'string' && sql.includes('as revenue')) {
          return { get: () => undefined };
        }
        return orderPrepare(sql);
      };
      expect(Order.getRevenue()).toBe(0);
      db.prepare = orderPrepare;

      expect(Array.isArray(Shipment.findAll())).toBe(true);
      expect(Array.isArray(Shipment.findAll({ status: 'delivered', order_id: ids.orderId, limit: 1 }))).toBe(true);
      expect(Shipment.updateStatus(99999999, 'processing')).toBeNull();

      const manualTracking = `CRF${uniqueValue('manual').replace(/[^A-Za-z0-9]/g, '').slice(0, 12).toUpperCase()}`;
      const manualShipmentId = db
        .prepare('INSERT INTO shipments (order_id, tracking_number, status, history) VALUES (?, ?, ?, NULL)')
        .run(ids.orderId, manualTracking, 'pending').lastInsertRowid;

      const updatedShipment = Shipment.updateStatus(manualShipmentId, 'processing');
      expect(updatedShipment.status).toBe('processing');

      db.prepare('UPDATE shipments SET history = NULL WHERE id = ?').run(manualShipmentId);
      expect(Shipment.getHistory(manualShipmentId)).toEqual([]);
      expect(Shipment.getHistory(99999999)).toEqual([]);
    });

    test('coupon, notification, review, and wishlist remaining branches are covered', () => {
      expect(Array.isArray(Coupon.findAll({ active: false }))).toBe(true);

      const toggledCode = uniqueValue('toggle_coupon').toUpperCase();
      const toggledCoupon = Coupon.create({
        code: toggledCode,
        discount_value: 10
      });
      expect(toggledCoupon).toBeTruthy();

      expect(Coupon.update(toggledCoupon.id, {})).toBeNull();
      expect(Coupon.update(toggledCoupon.id, { id: toggledCoupon.id })).toBeNull();
      const upperUpdated = Coupon.update(toggledCoupon.id, { code: 'lowerbranchcode' });
      expect(upperUpdated.code).toBe('LOWERBRANCHCODE');

      const onceToggled = Coupon.toggleActive(toggledCoupon.id);
      const twiceToggled = Coupon.toggleActive(toggledCoupon.id);
      expect(onceToggled.is_active).not.toBe(twiceToggled.is_active);
      expect(Coupon.toggleActive(99999999)).toBeNull();

      const expiredCode = uniqueValue('expired_coupon').toUpperCase();
      Coupon.create({
        code: expiredCode,
        discount_value: 10,
        valid_until: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      });
      const expiredValidation = Coupon.validate(expiredCode, 100);
      expect(expiredValidation.valid).toBe(false);
      expect(expiredValidation.error).toContain('expired');

      const typeFallbackCode = uniqueValue('type_fallback').toUpperCase();
      db.prepare(`
        INSERT INTO coupons (code, description, type, discount_type, value, discount_value, min_order, is_active, active)
        VALUES (?, '', 'fixed', NULL, 7, NULL, 0, 1, 1)
      `).run(typeFallbackCode);
      const typeFallbackValidation = Coupon.validate(typeFallbackCode, 20);
      expect(typeFallbackValidation.valid).toBe(true);
      expect(typeFallbackValidation.discount).toBe(7);

      const defaultNotification = Notification.create({
        user_id: ids.custId,
        title: 'Default type notification',
        message: 'No explicit type provided'
      });
      expect(defaultNotification.type).toBe('general');

      const endedNoBids = Notification.auctionEnded(ids.artId, ids.auctionId, 'Test Auction', false);
      expect(endedNoBids.message).toContain('no bids');

      expect(Array.isArray(Review.findByProductId(ids.vaseId, { limit: 1 }))).toBe(true);
      expect(Array.isArray(Review.findAll())).toBe(true);

      const reviewUserEmail = `${uniqueValue('review_user')}@test.com`;
      const reviewUserId = db
        .prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)')
        .run('Review User', reviewUserEmail, 'hash', 'customer', 'active').lastInsertRowid;

      const defaultReview = Review.create({
        product_id: ids.outOfStockId,
        user_id: reviewUserId,
        rating: 4
      });
      expect(defaultReview).toBeTruthy();

      const reviewPrepare = db.prepare.bind(db);
      db.prepare = (sql) => {
        if (
          typeof sql === 'string' &&
          sql.includes('FROM reviews') &&
          (sql.includes('AVG(rating) as avg_rating') || sql.includes('AVG(r.rating) as avg_rating'))
        ) {
          return { get: () => undefined };
        }
        return reviewPrepare(sql);
      };
      const averageFallback = Review.getAverageRating(ids.vaseId);
      expect(averageFallback.count).toBe(0);
      const artisanAverageFallback = Review.getArtisanAverageRating(ids.artId);
      expect(artisanAverageFallback.count).toBe(0);
      db.prepare = reviewPrepare;

      const reviewCountPrepare = db.prepare.bind(db);
      db.prepare = (sql) => {
        if (typeof sql === 'string' && sql.includes('SELECT COUNT(*) as count FROM reviews r WHERE 1=1')) {
          return { get: () => undefined };
        }
        return reviewCountPrepare(sql);
      };
      expect(Review.count()).toBe(0);
      db.prepare = reviewCountPrepare;

      expect(typeof Review.count()).toBe('number');
      expect(typeof Review.count({ status: 'visible', artisan_id: ids.artId })).toBe('number');

      Review.delete(defaultReview.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(reviewUserId);

      Wishlist.clear(ids.cust2Id);
      expect(Wishlist.add(ids.cust2Id, ids.vaseId)).toBe(true);
      expect(Wishlist.add(ids.cust2Id, ids.vaseId)).toBe(false);
      Wishlist.clear(ids.cust2Id);
    });
  });
};
