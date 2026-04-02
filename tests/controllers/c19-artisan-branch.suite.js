const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Artisan Controller Branch Coverage', () => {
    test('Artisan product validation and non-XHR delete branches are covered', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');

      const invalidCreate = await agent.post('/artisan/products').send({
        name: '',
        description: 'Missing name should fail',
        price: 20,
        stock: 1,
        category_id: ids.potId
      });
      expect(invalidCreate.statusCode).toBe(302);
      expect(invalidCreate.headers.location).toContain('/artisan/products/new');

      const tempProductId = db.prepare(`
        INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active)
        VALUES (?, ?, ?, ?, ?, ?, '[]', 'approved', 1)
      `).run(ids.artId, ids.potId, `Artisan Validation Product ${makeUnique('artisan')}`, 'Validation product', 28, 2).lastInsertRowid;

      const invalidUpdate = await agent.post(`/artisan/products/${tempProductId}`).send({
        name: 'x'.repeat(205),
        description: 'Too long name',
        price: 28,
        stock: 2,
        category_id: ids.potId
      });
      expect(invalidUpdate.statusCode).toBe(302);
      expect(invalidUpdate.headers.location).toContain(`/artisan/products/${tempProductId}/edit`);

      const deleteProduct = await agent.post(`/artisan/products/${tempProductId}/delete`);
      expect(deleteProduct.statusCode).toBe(302);
      expect(deleteProduct.headers.location).toContain('/artisan/products');

      const invalidDelete = await agent.post('/artisan/products/999999/delete');
      expect(invalidDelete.statusCode).toBe(302);
      expect(invalidDelete.headers.location).toContain('/artisan/products');
    });

    test('Artisan non-XHR status updates and catch redirects are covered', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');
      const Product = require('../../models/Product');
      const Auction = require('../../models/Auction');
      const ArtisanProfile = require('../../models/ArtisanProfile');
      const Order = require('../../models/Order');

      const orderProductId = db.prepare(`
        INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active)
        VALUES (?, ?, ?, ?, ?, ?, '[]', 'approved', 1)
      `).run(ids.artId, ids.potId, `Artisan Order Product ${makeUnique('artisan')}`, 'Order product', 42, 3).lastInsertRowid;

      const orderId = db.prepare(`
        INSERT INTO orders (
          user_id, subtotal, shipping_cost, discount_amount, total_amount,
          status, payment_method, payment_status, shipping_address, shipping_city, shipping_country
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(ids.custId, 42, 0, 0, 42, 'confirmed', 'card', 'paid', 'Road 66', 'Manama', 'Bahrain').lastInsertRowid;

      db.prepare(`
        INSERT INTO order_items (order_id, product_id, artisan_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(orderId, orderProductId, ids.artId, 1, 42, 42);

      const statusUpdate = await agent.post(`/artisan/orders/${orderId}/status`).send({ status: 'shipped' });
      expect(statusUpdate.statusCode).toBe(302);
      expect(statusUpdate.headers.location).toContain(`/artisan/orders/${orderId}`);

      const missingAuction = await agent.post('/artisan/auctions/999999/cancel');
      expect(missingAuction.statusCode).toBe(302);
      expect(missingAuction.headers.location).toContain('/artisan/auctions');

      const createAuctionSpy = jest.spyOn(Auction, 'create').mockImplementation(() => {
        throw new Error('Forced auction create catch');
      });
      const createAuctionFallback = await agent.post('/artisan/auctions').send({
        product_id: ids.vaseId,
        title: `Force catch ${makeUnique('auction')}`,
        description: 'Force catch branch',
        starting_bid: 20,
        reserve_price: 30,
        bid_increment: 1,
        start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      });
      expect(createAuctionFallback.statusCode).toBe(302);
      expect(createAuctionFallback.headers.location).toContain('/artisan/auctions/new');
      createAuctionSpy.mockRestore();

      const productsSpy = jest.spyOn(Product, 'getByArtisan').mockImplementation(() => {
        throw new Error('Forced products catch');
      });
      const productsFallback = await agent.get('/artisan/products?page=2');
      expect(productsFallback.statusCode).toBe(302);
      expect(productsFallback.headers.location).toContain('/artisan/dashboard');
      productsSpy.mockRestore();

      const orderDetailSpy = jest.spyOn(Order, 'findById').mockImplementation(() => {
        throw new Error('Forced order detail catch');
      });
      const orderDetailFallback = await agent.get(`/artisan/orders/${ids.orderId}`);
      expect(orderDetailFallback.statusCode).toBe(302);
      expect(orderDetailFallback.headers.location).toContain('/artisan/orders');
      orderDetailSpy.mockRestore();

      const analyticsSpy = jest.spyOn(ArtisanProfile, 'getStats').mockImplementation(() => {
        throw new Error('Forced analytics catch');
      });
      const analyticsFallback = await agent.get('/artisan/analytics');
      expect(analyticsFallback.statusCode).toBe(302);
      expect(analyticsFallback.headers.location).toContain('/artisan/dashboard');
      analyticsSpy.mockRestore();
    });
  });

};

