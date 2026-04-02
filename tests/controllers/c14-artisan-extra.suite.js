const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Artisan Routes Additional Coverage', () => {
    let agent;

    beforeAll(async () => {
      agent = await loginAs('artisan@test.com', 'art123');
    });

    test('Artisan pending/profile pages and profile update flow are covered', async () => {
      const pendingPage = await agent.get('/artisan/pending');
      expect(pendingPage.statusCode).toBe(200);

      const profilePage = await agent.get('/artisan/profile');
      expect(profilePage.statusCode).toBe(200);

      const updateProfile = await agent.post('/artisan/profile').send({
        name: 'Artisan',
        phone: '555111222',
        shop_name: 'Test Shop',
        bio: `Updated bio ${makeUnique('bio')}`,
        return_policy: 'No return policy'
      });
      expect(updateProfile.statusCode).toBe(302);

      const updatedArtisan = db.prepare('SELECT bio FROM artisan_profiles WHERE user_id = ?').get(ids.artId);
      expect(updatedArtisan.bio).toContain('Updated bio');
    });

    test('Artisan product edit/update/delete and not-found branches are covered', async () => {
      const tempProductId = db.prepare(`
        INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active)
        VALUES (?, ?, ?, ?, ?, ?, '[]', 'approved', 1)
      `).run(ids.artId, ids.potId, `Artisan Temp ${makeUnique('product')}`, 'Temp artisan product', 30, 5).lastInsertRowid;

      const editOwn = await agent.get(`/artisan/products/${tempProductId}/edit`);
      expect(editOwn.statusCode).toBe(200);

      const updateOwn = await agent.post(`/artisan/products/${tempProductId}`).send({
        name: `Updated ${makeUnique('product')}`,
        description: 'Updated description',
        price: 35,
        stock: 7,
        category_id: ids.potId
      });
      expect(updateOwn.statusCode).toBe(302);

      const updated = db.prepare('SELECT price, stock FROM products WHERE id = ?').get(tempProductId);
      expect(updated.price).toBe(35);
      expect(updated.stock).toBe(7);

      const invalidEdit = await agent.get('/artisan/products/999999/edit');
      expect(invalidEdit.statusCode).toBe(302);
      expect(invalidEdit.headers.location).toContain('/artisan/products');

      const deleted = await agent
        .post(`/artisan/products/${tempProductId}/delete`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(deleted.statusCode).toBe(200);
      expect(deleted.body.success).toBe(true);
      expect(db.prepare('SELECT id FROM products WHERE id = ?').get(tempProductId)).toBeUndefined();
    });

    test('Artisan order detail/status, reviews, and analytics routes are covered', async () => {
      const orderDetail = await agent.get(`/artisan/orders/${ids.orderId}`);
      expect(orderDetail.statusCode).toBe(200);

      const missingOrder = await agent.get('/artisan/orders/999999');
      expect(missingOrder.statusCode).toBe(302);
      expect(missingOrder.headers.location).toContain('/artisan/orders');

      const orderStatus = await agent
        .post(`/artisan/orders/${ids.orderId}/status`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ status: 'processing' });
      expect(orderStatus.statusCode).toBe(200);
      expect(orderStatus.body.success).toBe(true);

      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('delivered', ids.orderId);

      const reviews = await agent.get('/artisan/reviews');
      expect(reviews.statusCode).toBe(200);

      const analytics = await agent.get('/artisan/analytics');
      expect(analytics.statusCode).toBe(200);
    });

    test('Artisan auction create/cancel paths cover valid and invalid products', async () => {
      const newAuctionPage = await agent.get('/artisan/auctions/new');
      expect(newAuctionPage.statusCode).toBe(200);

      const invalidProductAuction = await agent.post('/artisan/auctions').send({
        product_id: 999999,
        title: 'Invalid Auction',
        description: 'Invalid product',
        starting_bid: 10,
        reserve_price: 20,
        bid_increment: 1,
        start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      });
      expect(invalidProductAuction.statusCode).toBe(302);
      expect(invalidProductAuction.headers.location).toContain('/artisan/auctions/new');

      const tempProductId = db.prepare(`
        INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active)
        VALUES (?, ?, ?, ?, ?, ?, '[]', 'approved', 1)
      `).run(ids.artId, ids.potId, `Auction Product ${makeUnique('artisan')}`, 'Auction product', 40, 3).lastInsertRowid;

      const auctionTitle = `Artisan Auction ${makeUnique('title')}`;
      const createAuction = await agent.post('/artisan/auctions').send({
        product_id: tempProductId,
        title: auctionTitle,
        description: 'Valid auction',
        starting_bid: 15,
        reserve_price: 30,
        bid_increment: 2,
        start_time: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        end_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
      });
      expect(createAuction.statusCode).toBe(302);
      expect(createAuction.headers.location).toContain('/artisan/auctions');

      const createdAuction = db.prepare('SELECT id FROM auctions WHERE title = ?').get(auctionTitle);
      expect(createdAuction).toBeTruthy();

      const cancelAuction = await agent.post(`/artisan/auctions/${createdAuction.id}/cancel`);
      expect(cancelAuction.statusCode).toBe(302);
      expect(db.prepare('SELECT status FROM auctions WHERE id = ?').get(createdAuction.id).status).toBe('cancelled');

      const soldAuction = db.prepare('SELECT id, status FROM auctions WHERE status = ? LIMIT 1').get('sold');
      expect(soldAuction).toBeTruthy();

      const cannotCancelSold = await agent.post(`/artisan/auctions/${soldAuction.id}/cancel`);
      expect(cannotCancelSold.statusCode).toBe(302);
      expect(db.prepare('SELECT status FROM auctions WHERE id = ?').get(soldAuction.id).status).toBe('sold');
    });
  });
};

