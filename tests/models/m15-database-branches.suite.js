module.exports = ({ getTestContext }) => {
  let db;
  let ids;

  function uniqueValue(prefix) {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  beforeAll(() => {
    ({ db, ids } = getTestContext());
  });

  describe('Database Wrapper and Model DB Branches', () => {
    const Product = require('../../models/Product');
    const Cart = require('../../models/Cart');
    const Auction = require('../../models/Auction');
    const Coupon = require('../../models/Coupon');
    const Notification = require('../../models/Notification');
    const Shipment = require('../../models/Shipment');
    const Order = require('../../models/Order');

    test('Product and cart branches exercise in-stock, offset, merge, and validation paths', () => {
      const beforeStock = Product.findById(ids.vaseId).stock;

      const pagedInStock = Product.findAll({
        status: 'approved',
        inStock: true,
        sort: 'popular',
        limit: 2,
        offset: 1
      });
      expect(Array.isArray(pagedInStock)).toBe(true);
      pagedInStock.forEach((row) => {
        expect(row.stock).toBeGreaterThan(0);
      });

      const popular = Product.getPopular(3);
      expect(Array.isArray(popular)).toBe(true);

      const byArtisan = Product.getByArtisan(ids.artId, { status: 'approved', limit: 3 });
      expect(Array.isArray(byArtisan)).toBe(true);

      Product.updateStock(ids.vaseId, 2);
      Product.decreaseStock(ids.vaseId, 1);
      Product.decreaseStock(ids.vaseId, 999999);

      const afterStock = Product.findById(ids.vaseId).stock;
      expect(afterStock).toBe(beforeStock + 1);

      Product.updateStock(ids.vaseId, beforeStock - afterStock);

      Cart.clear(ids.cust2Id, null);
      const sessionId = uniqueValue('guest_session');

      Cart.addItem(ids.cust2Id, null, ids.ringId, 1);
      Cart.addItem(null, sessionId, ids.ringId, 2);
      Cart.addItem(null, sessionId, ids.vaseId, 1);

      expect(Cart.getCount(null, sessionId)).toBe(3);

      Cart.mergeGuestCart(ids.cust2Id, sessionId);

      const userItems = Cart.getItems(ids.cust2Id, null);
      const mergedRing = userItems.find((item) => item.product_id === ids.ringId);
      expect(mergedRing).toBeTruthy();
      expect(mergedRing.quantity).toBe(3);

      const mergedVase = userItems.find((item) => item.product_id === ids.vaseId);
      expect(mergedVase).toBeTruthy();
      expect(Cart.getItems(null, sessionId).length).toBe(0);
      expect(Cart.getItems()).toEqual([]);

      const sessionOnly = uniqueValue('session_only');
      Cart.addItem(null, sessionOnly, ids.vaseId, 2);
      Cart.updateItemQuantity(null, sessionOnly, ids.vaseId, 4);
      let sessionItems = Cart.getItems(null, sessionOnly);
      expect(sessionItems[0].quantity).toBe(4);

      Cart.updateItemQuantity(null, sessionOnly, ids.vaseId, 0);
      sessionItems = Cart.getItems(null, sessionOnly);
      expect(sessionItems.length).toBe(0);

      Cart.addItem(null, sessionOnly, ids.ringId, 1);
      Cart.removeItem(null, sessionOnly, ids.ringId);
      expect(Cart.getItems(null, sessionOnly).length).toBe(0);

      Cart.addItem(null, sessionOnly, ids.vaseId, 1);
      Cart.clear(null, sessionOnly);
      expect(Cart.getItems(null, sessionOnly).length).toBe(0);

      Cart.addItem(ids.cust2Id, null, ids.outOfStockId, 1);
      const issues = Cart.validateItems(ids.cust2Id, null);
      expect(issues.some((issue) => issue.productId === ids.outOfStockId)).toBe(true);

      Cart.clear(ids.cust2Id, null);
    });

    test('Auction, order, and shipment branches cover end/count/stats and filter paths', () => {
      const now = Date.now();
      const startTime = new Date(now - 60 * 60 * 1000).toISOString();
      const endTime = new Date(now + 60 * 60 * 1000).toISOString();

      const noWinnerAuctionId = db.prepare(`
        INSERT INTO auctions (product_id, artisan_id, title, starting_price, current_highest_bid, bid_increment, start_time, end_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(
        ids.vaseId,
        ids.artId,
        uniqueValue('No winner auction'),
        20,
        20,
        1,
        startTime,
        endTime
      ).lastInsertRowid;

      const winnerAuctionId = db.prepare(`
        INSERT INTO auctions (product_id, artisan_id, title, starting_price, current_highest_bid, bid_increment, start_time, end_time, status, winner_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(
        ids.ringId,
        ids.artId,
        uniqueValue('Winner auction'),
        25,
        40,
        2,
        startTime,
        endTime,
        ids.custId
      ).lastInsertRowid;

      expect(Auction.endAuction(99999999)).toBeNull();

      const ended = Auction.endAuction(noWinnerAuctionId);
      expect(ended.status).toBe('ended');

      const sold = Auction.endAuction(winnerAuctionId);
      expect(sold.status).toBe('sold');

      const cancelled = Auction.cancel(noWinnerAuctionId);
      expect(cancelled.status).toBe('cancelled');

      const active = Auction.getActive(5);
      expect(Array.isArray(active)).toBe(true);

      const endingSoon = Auction.getEndingSoon(5);
      expect(Array.isArray(endingSoon)).toBe(true);

      expect(Auction.count({ artisan_id: ids.artId })).toBeGreaterThan(0);

      const auctionStats = Auction.getStats();
      expect(auctionStats).toHaveProperty('total');
      expect(auctionStats).toHaveProperty('sold');

      expect(Order.count({ user_id: ids.custId })).toBeGreaterThan(0);
      expect(Order.count({ artisan_id: ids.artId })).toBeGreaterThan(0);
      expect(Order.count({ payment_status: 'paid' })).toBeGreaterThan(0);

      const orderStats = Order.getStats();
      expect(orderStats).toHaveProperty('totalRevenue');

      const orderFiltered = Order.findAll({
        status: 'delivered',
        payment_status: 'paid',
        user_id: ids.custId,
        artisan_id: ids.artId,
        search: String(ids.orderId),
        date_from: '2000-01-01',
        date_to: '2999-01-01',
        limit: 5,
        offset: 1
      });
      expect(Array.isArray(orderFiltered)).toBe(true);

      const shipmentRows = Shipment.findAll({ order_id: ids.orderId, status: 'delivered', limit: 1 });
      expect(Array.isArray(shipmentRows)).toBe(true);
      shipmentRows.forEach((row) => {
        expect(row.order_id).toBe(ids.orderId);
      });
    });

    test('Coupon and notification branches cover time window, usage, cap, fixed, and delete paths', () => {
      const futureCode = uniqueValue('future_coupon').toUpperCase();
      const futureCoupon = Coupon.create({
        code: futureCode,
        description: 'Future coupon',
        discount_type: 'percent',
        discount_value: 10,
        min_purchase: 0,
        valid_from: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        valid_until: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      });

      const futureValidation = Coupon.validate(futureCode, 100);
      expect(futureValidation.valid).toBe(false);
      expect(futureValidation.error).toContain('not yet active');

      const limitedCode = uniqueValue('limited_coupon').toUpperCase();
      const limitedCoupon = Coupon.create({
        code: limitedCode,
        description: 'Limited coupon',
        discount_type: 'percent',
        discount_value: 10,
        min_purchase: 0,
        usage_limit: 1
      });

      Coupon.update(limitedCoupon.id, { times_used: 1, used_count: 1 });
      const limitedValidation = Coupon.validate(limitedCode, 100);
      expect(limitedValidation.valid).toBe(false);
      expect(limitedValidation.error).toContain('usage limit');

      const cappedCode = uniqueValue('capped_coupon').toUpperCase();
      const cappedCoupon = Coupon.create({
        code: cappedCode,
        description: 'Capped coupon',
        discount_type: 'percent',
        discount_value: 50,
        min_purchase: 0,
        max_discount: 20
      });

      const cappedValidation = Coupon.validate(cappedCode, 100);
      expect(cappedValidation.valid).toBe(true);
      expect(cappedValidation.discount).toBe(20);

      const fixedCode = uniqueValue('fixed_coupon').toUpperCase();
      const fixedCoupon = Coupon.create({
        code: fixedCode,
        description: 'Fixed coupon',
        discount_type: 'fixed',
        discount_value: 50,
        min_purchase: 0
      });

      const fixedValidation = Coupon.validate(fixedCode, 20);
      expect(fixedValidation.valid).toBe(true);
      expect(fixedValidation.discount).toBe(20);

      const activeLimited = Coupon.findAll({ active: true, limit: 2 });
      expect(Array.isArray(activeLimited)).toBe(true);
      expect(activeLimited.length).toBeLessThanOrEqual(2);

      [futureCoupon.id, limitedCoupon.id, cappedCoupon.id, fixedCoupon.id].forEach((couponId) => {
        Coupon.delete(couponId);
      });

      const notifA = Notification.create({
        user_id: ids.cust2Id,
        type: 'order',
        title: 'Order notification',
        message: 'Order message'
      });
      const notifB = Notification.create({
        user_id: ids.cust2Id,
        type: 'system',
        title: 'System notification',
        message: 'System message'
      });

      const filtered = Notification.findByUserId(ids.cust2Id, { unread: true, type: 'order', limit: 10 });
      expect(Array.isArray(filtered)).toBe(true);
      filtered.forEach((notif) => {
        expect(notif.type).toBe('order');
      });

      Notification.markAsRead(notifA.id);
      Notification.markAllAsRead(ids.cust2Id);
      expect(Notification.getUnreadCount(ids.cust2Id)).toBe(0);

      Notification.delete(notifB.id);
      Notification.create({ user_id: ids.cust2Id, type: 'message', title: 'Temp A', message: 'A' });
      Notification.create({ user_id: ids.cust2Id, type: 'message', title: 'Temp B', message: 'B' });
      Notification.deleteAll(ids.cust2Id);
      expect(Notification.findByUserId(ids.cust2Id).length).toBe(0);
    });

    test('Isolated database module covers uninitialized, memory-save skip, and file reload branches', async () => {
      const fs = require('fs');
      const path = require('path');
      const originalPath = process.env.CRAFTIFY_DB_PATH;

      const writeSpy = jest.spyOn(fs, 'writeFileSync');
      try {
        let memoryDbModule;
        jest.isolateModules(() => {
          process.env.CRAFTIFY_DB_PATH = ':memory:';
          memoryDbModule = require('../../config/database');
          expect(() => memoryDbModule.getDb()).toThrow('Database not initialized');
          expect(() => memoryDbModule.db).toThrow('Database not initialized');
        });

        await memoryDbModule.initDatabase();
        memoryDbModule
          .getDb()
          .prepare('INSERT INTO categories (name, slug, is_active) VALUES (?, ?, 1)')
          .run(uniqueValue('Memory category'), uniqueValue('memory_slug').toLowerCase());

        expect(writeSpy).not.toHaveBeenCalled();
      } finally {
        writeSpy.mockRestore();
        process.env.CRAFTIFY_DB_PATH = originalPath;
      }

      const reloadDbPath = path.join(__dirname, '..', '..', `craftify.reload.${Date.now()}.db`);
      try {
        let fileDbModule;
        jest.isolateModules(() => {
          process.env.CRAFTIFY_DB_PATH = reloadDbPath;
          fileDbModule = require('../../config/database');
        });

        await fileDbModule.initDatabase();
        const reloadSlug = uniqueValue('reload_slug').toLowerCase();

        fileDbModule
          .getDb()
          .prepare('INSERT INTO categories (name, slug, is_active) VALUES (?, ?, 1)')
          .run(uniqueValue('Reload category'), reloadSlug);

        await fileDbModule.initDatabase();

        const reloaded = fileDbModule
          .getDb()
          .prepare('SELECT slug FROM categories WHERE slug = ?')
          .get(reloadSlug);

        expect(reloaded).toBeTruthy();
        expect(reloaded.slug).toBe(reloadSlug);
      } finally {
        process.env.CRAFTIFY_DB_PATH = originalPath;
        try {
          fs.unlinkSync(reloadDbPath);
        } catch (e) {
          // Ignore cleanup errors.
        }
      }
    });

    test('Isolated database module handles schema initialization catch path', async () => {
      const fs = require('fs');
      const path = require('path');
      const originalPath = process.env.CRAFTIFY_DB_PATH;
      const failingDbPath = path.join(__dirname, '..', '..', `craftify.fail.${Date.now()}.db`);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw new Error('forced schema save failure');
      });

      try {
        let failingDbModule;
        jest.isolateModules(() => {
          process.env.CRAFTIFY_DB_PATH = failingDbPath;
          failingDbModule = require('../../config/database');
        });

        await expect(failingDbModule.initDatabase()).rejects.toThrow('forced schema save failure');

        const sawSchemaError = consoleSpy.mock.calls.some((call) => call[0] === 'Schema initialization error:');
        expect(sawSchemaError).toBe(true);
      } finally {
        writeSpy.mockRestore();
        consoleSpy.mockRestore();
        process.env.CRAFTIFY_DB_PATH = originalPath;
        try {
          fs.unlinkSync(failingDbPath);
        } catch (e) {
          // Ignore cleanup errors.
        }
      }
    });

    test('Database wrapper run/get/all error handlers and transaction rollback branches are exercised', () => {
      const { getDb } = require('../../config/database');
      const activeDb = getDb();
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      try {
        expect(() => {
          activeDb.prepare('INSERT INTO missing_table (name) VALUES (?)').run('x');
        }).toThrow();

        expect(() => {
          activeDb.prepare('SELECT * FROM missing_table').get();
        }).toThrow();

        expect(() => {
          activeDb.prepare('SELECT * FROM missing_table').all();
        }).toThrow();

        activeDb.exec('CREATE TABLE IF NOT EXISTS __db_exec_branch (id INTEGER PRIMARY KEY AUTOINCREMENT)');
        const execTable = activeDb
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__db_exec_branch'")
          .get();
        expect(execTable).toBeTruthy();

        const execSpy = jest.spyOn(activeDb, 'exec').mockImplementation(() => {});

        const commitTx = activeDb.transaction((label) => label);
        const commitLabel = uniqueValue('tx_commit');
        expect(commitTx(commitLabel)).toBe(commitLabel);
        expect(execSpy).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION');
        expect(execSpy).toHaveBeenNthCalledWith(2, 'COMMIT');

        execSpy.mockClear();

        const rollbackTx = activeDb.transaction(() => {
          throw new Error('forced transaction rollback');
        });
        expect(() => rollbackTx()).toThrow('forced transaction rollback');
        expect(execSpy).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION');
        expect(execSpy).toHaveBeenNthCalledWith(2, 'ROLLBACK');
        execSpy.mockRestore();

        expect(consoleSpy).toHaveBeenCalled();
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });
};
