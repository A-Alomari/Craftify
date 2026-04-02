const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Admin Routes Additional Coverage', () => {
    test('Admin category, order, and auction mutations are covered', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');
      const categoryName = `Category ${makeUnique('admin')}`;
      const createdCategory = await agent
        .post('/admin/categories')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ name: categoryName, description: 'Created by test' });
      expect(createdCategory.statusCode).toBe(200);
      expect(createdCategory.body.success).toBe(true);

      const category = db.prepare('SELECT id FROM categories WHERE name = ?').get(categoryName);
      expect(category).toBeTruthy();

      const updatedCategory = await agent
        .post(`/admin/categories/${category.id}`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ name: `${categoryName} Updated`, description: 'Updated by test' });
      expect(updatedCategory.statusCode).toBe(200);
      expect(updatedCategory.body.success).toBe(true);

      const deletedCategory = await agent
        .post(`/admin/categories/${category.id}/delete`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(deletedCategory.statusCode).toBe(200);
      expect(deletedCategory.body.success).toBe(true);
      expect(db.prepare('SELECT id FROM categories WHERE id = ?').get(category.id)).toBeUndefined();

      const orderDetail = await agent.get(`/admin/orders/${ids.orderId}`);
      expect(orderDetail.statusCode).toBe(200);

      const orderUpdate = await agent
        .post(`/admin/orders/${ids.orderId}/status`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ status: 'shipped' });
      expect(orderUpdate.statusCode).toBe(200);
      expect(orderUpdate.body.success).toBe(true);
      expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(ids.orderId).status).toBe('shipped');
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('delivered', ids.orderId);

      const tempAuctionTitle = `Admin Cancel Auction ${makeUnique('auc')}`;
      const tempProductId = db.prepare(`
        INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active)
        VALUES (?, ?, ?, ?, ?, ?, '[]', 'approved', 1)
      `).run(ids.artId, ids.potId, `Admin Temp Product ${makeUnique('prod')}`, 'Temp product', 25, 2).lastInsertRowid;
      const tempAuctionId = db.prepare(`
        INSERT INTO auctions (product_id, artisan_id, title, starting_price, current_highest_bid, bid_increment, start_time, end_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(
        tempProductId,
        ids.artId,
        tempAuctionTitle,
        20,
        20,
        1,
        new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        new Date(Date.now() + 60 * 60 * 1000).toISOString()
      ).lastInsertRowid;

      const cancelAuction = await agent
        .post(`/admin/auctions/${tempAuctionId}/cancel`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(cancelAuction.statusCode).toBe(200);
      expect(cancelAuction.body.success).toBe(true);
      expect(db.prepare('SELECT status FROM auctions WHERE id = ?').get(tempAuctionId).status).toBe('cancelled');

      const invalidAuction = await agent.post('/admin/auctions/0/cancel');
      expect(invalidAuction.statusCode).toBe(302);
      expect(invalidAuction.headers.location).toContain('/admin/auctions');
    });

  });
};
