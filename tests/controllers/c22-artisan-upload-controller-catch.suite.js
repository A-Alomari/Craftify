const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Artisan Controller and Upload Middleware Coverage', () => {
    test('Artisan upload branches and remaining catch branches are covered', async () => {
      const agent = await loginAs('artisan@test.com', 'art123');
      const User = require('../../models/User');
      const ArtisanProfile = require('../../models/ArtisanProfile');
      const Product = require('../../models/Product');
      const Order = require('../../models/Order');
      const Auction = require('../../models/Auction');
      const Review = require('../../models/Review');

      const profileUpload = await agent
        .post('/artisan/profile')
        .field('name', 'Artisan')
        .field('phone', '44455566')
        .field('shop_name', 'Test Shop')
        .field('bio', 'Upload profile bio')
        .field('return_policy', 'Upload return policy')
        .attach('profile_image', Buffer.from('profile-image-data'), { filename: 'profile.png', contentType: 'image/png' });
      expect(profileUpload.statusCode).toBe(302);
      expect(profileUpload.headers.location).toContain('/artisan/profile');

      const uploadProductName = `Upload Product ${makeUnique('artisan')}`;
      const createWithImage = await agent
        .post('/artisan/products')
        .field('name', uploadProductName)
        .field('description', 'Created with image upload')
        .field('price', '29')
        .field('stock', '4')
        .field('category_id', String(ids.potId))
        .attach('images', Buffer.from('product-image-data'), { filename: 'product.png', contentType: 'image/png' });
      expect(createWithImage.statusCode).toBe(302);
      expect(createWithImage.headers.location).toContain('/artisan/products');

      const uploadedProduct = db.prepare('SELECT id FROM products WHERE name = ?').get(uploadProductName);
      expect(uploadedProduct).toBeTruthy();

      const updateWithImage = await agent
        .post(`/artisan/products/${uploadedProduct.id}`)
        .field('name', `${uploadProductName} Updated`)
        .field('description', 'Updated with additional image')
        .field('price', '31')
        .field('stock', '6')
        .field('category_id', String(ids.potId))
        .attach('images', Buffer.from('product-image-data-2'), { filename: 'product2.png', contentType: 'image/png' });
      expect(updateWithImage.statusCode).toBe(302);
      expect(updateWithImage.headers.location).toContain('/artisan/products');

      const auctionNoReserveTitle = `No Reserve Auction ${makeUnique('artisan')}`;
      const auctionNoReserve = await agent.post('/artisan/auctions').send({
        product_id: uploadedProduct.id,
        title: auctionNoReserveTitle,
        description: 'Auction without reserve value',
        starting_bid: 12,
        reserve_price: '',
        bid_increment: 1,
        start_time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() + 90 * 60 * 1000).toISOString()
      });
      expect(auctionNoReserve.statusCode).toBe(302);
      expect(auctionNoReserve.headers.location).toContain('/artisan/auctions');

      const dashboardSpy = jest.spyOn(ArtisanProfile, 'getStats').mockImplementation(() => {
        throw new Error('Forced artisan dashboard catch');
      });
      const dashboardCatch = await agent.get('/artisan/dashboard');
      expect(dashboardCatch.statusCode).toBe(302);
      expect(dashboardCatch.headers.location).toContain('/');
      dashboardSpy.mockRestore();

      const updateProfileSpy = jest.spyOn(ArtisanProfile, 'update').mockImplementation(() => {
        throw new Error('Forced artisan update profile catch');
      });
      const updateProfileCatch = await agent.post('/artisan/profile').send({
        name: 'Artisan',
        phone: '100200',
        shop_name: 'Test Shop',
        bio: 'Catch bio',
        return_policy: 'Catch policy'
      });
      expect(updateProfileCatch.statusCode).toBe(302);
      expect(updateProfileCatch.headers.location).toContain('/artisan/profile');
      updateProfileSpy.mockRestore();

      const createProductSpy = jest.spyOn(Product, 'create').mockImplementation(() => {
        throw new Error('Forced artisan create product catch');
      });
      const createProductCatch = await agent.post('/artisan/products').send({
        name: `Catch Product ${makeUnique('artisan')}`,
        description: 'Catch product',
        price: 19,
        stock: 1,
        category_id: ids.potId
      });
      expect(createProductCatch.statusCode).toBe(302);
      expect(createProductCatch.headers.location).toContain('/artisan/products/new');
      createProductSpy.mockRestore();

      const editProductSpy = jest.spyOn(Product, 'findById').mockImplementation(() => {
        throw new Error('Forced artisan edit product catch');
      });
      const editProductCatch = await agent.get(`/artisan/products/${ids.vaseId}/edit`);
      expect(editProductCatch.statusCode).toBe(302);
      expect(editProductCatch.headers.location).toContain('/artisan/products');
      editProductSpy.mockRestore();

      const updateProductSpy = jest.spyOn(Product, 'update').mockImplementation(() => {
        throw new Error('Forced artisan update product catch');
      });
      const updateProductCatch = await agent.post(`/artisan/products/${uploadedProduct.id}`).send({
        name: `${uploadProductName} Catch`,
        description: 'Catch update',
        price: 30,
        stock: 2,
        category_id: ids.potId
      });
      expect(updateProductCatch.statusCode).toBe(302);
      expect(updateProductCatch.headers.location).toContain('/artisan/products');
      updateProductSpy.mockRestore();

      const deleteProductSpy = jest.spyOn(Product, 'delete').mockImplementation(() => {
        throw new Error('Forced artisan delete product catch');
      });
      const deleteProductCatch = await agent.post(`/artisan/products/${uploadedProduct.id}/delete`);
      expect(deleteProductCatch.statusCode).toBe(302);
      expect(deleteProductCatch.headers.location).toContain('/artisan/products');
      deleteProductSpy.mockRestore();

      const ordersSpy = jest.spyOn(Order, 'findAll').mockImplementation(() => {
        throw new Error('Forced artisan orders catch');
      });
      const ordersCatch = await agent.get('/artisan/orders');
      expect(ordersCatch.statusCode).toBe(302);
      expect(ordersCatch.headers.location).toContain('/artisan/dashboard');
      ordersSpy.mockRestore();

      const foreignProductId = db.prepare(`
        INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active)
        VALUES (?, ?, ?, ?, ?, ?, '[]', 'approved', 1)
      `).run(ids.cust2Id, ids.potId, `Foreign Artisan Product ${makeUnique('artisan')}`, 'Foreign product', 22, 2).lastInsertRowid;

      const foreignOrderId = db.prepare(`
        INSERT INTO orders (
          user_id, subtotal, shipping_cost, discount_amount, total_amount,
          status, payment_method, payment_status, shipping_address, shipping_city, shipping_country
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(ids.custId, 22, 0, 0, 22, 'confirmed', 'card', 'paid', 'Road 44', 'Manama', 'Bahrain').lastInsertRowid;

      db.prepare(`
        INSERT INTO order_items (order_id, product_id, artisan_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(foreignOrderId, foreignProductId, ids.cust2Id, 1, 22, 22);

      const foreignOrderDetail = await agent.get(`/artisan/orders/${foreignOrderId}`);
      expect(foreignOrderDetail.statusCode).toBe(302);
      expect(foreignOrderDetail.headers.location).toContain('/artisan/orders');

      const updateOrderSpy = jest.spyOn(Order, 'updateStatus').mockImplementation(() => {
        throw new Error('Forced artisan update order status catch');
      });
      const updateOrderCatch = await agent
        .post(`/artisan/orders/${ids.orderId}/status`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ status: 'processing' });
      expect(updateOrderCatch.statusCode).toBe(500);
      expect(updateOrderCatch.body.success).toBe(false);
      updateOrderSpy.mockRestore();

      const auctionsSpy = jest.spyOn(Auction, 'findAll').mockImplementation(() => {
        throw new Error('Forced artisan auctions catch');
      });
      const auctionsCatch = await agent.get('/artisan/auctions');
      expect(auctionsCatch.statusCode).toBe(302);
      expect(auctionsCatch.headers.location).toContain('/artisan/dashboard');
      auctionsSpy.mockRestore();

      const cancelAuctionSpy = jest.spyOn(Auction, 'cancel').mockImplementation(() => {
        throw new Error('Forced artisan cancel auction catch');
      });
      const cancelAuctionCatch = await agent.post(`/artisan/auctions/${ids.auctionId}/cancel`);
      expect(cancelAuctionCatch.statusCode).toBe(302);
      expect(cancelAuctionCatch.headers.location).toContain('/artisan/auctions');
      cancelAuctionSpy.mockRestore();

      const reviewsSpy = jest.spyOn(Review, 'findAll').mockImplementation(() => {
        throw new Error('Forced artisan reviews catch');
      });
      const reviewsCatch = await agent.get('/artisan/reviews');
      expect(reviewsCatch.statusCode).toBe(302);
      expect(reviewsCatch.headers.location).toContain('/artisan/dashboard');
      reviewsSpy.mockRestore();

      const userUpdateSpy = jest.spyOn(User, 'update').mockImplementation(() => {
        throw new Error('Forced artisan user update catch');
      });
      await agent.post('/artisan/profile').send({
        name: 'Artisan',
        phone: '9999',
        shop_name: 'Test Shop',
        bio: 'Final restore',
        return_policy: 'Final restore'
      });
      userUpdateSpy.mockRestore();
    });

  });
};
