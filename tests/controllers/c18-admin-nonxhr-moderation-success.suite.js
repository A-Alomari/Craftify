const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Admin Controller Non-XHR Coverage', () => {
    test('Admin non-XHR moderation endpoints cover success flows', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');

      const artisanUserId = db.prepare('INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)')
        .run(`Moderated Artisan ${makeUnique('admin')}`, `${makeUnique('moderated_artisan')}@test.com`, 'hash', 'artisan', 'active')
        .lastInsertRowid;
      db.prepare('INSERT INTO artisan_profiles (user_id, shop_name, bio, is_approved) VALUES (?, ?, ?, 0)')
        .run(artisanUserId, 'Moderated Shop', 'Moderated bio');

      const approveArtisan = await agent.post(`/admin/artisans/${artisanUserId}/approve`);
      expect(approveArtisan.statusCode).toBe(302);
      expect(approveArtisan.headers.location).toContain('/admin/artisans');

      const rejectArtisan = await agent.post(`/admin/artisans/${artisanUserId}/reject`);
      expect(rejectArtisan.statusCode).toBe(302);
      expect(rejectArtisan.headers.location).toContain('/admin/artisans');

      const pendingProductId = db.prepare(`
        INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active, featured)
        VALUES (?, ?, ?, ?, ?, ?, '[]', 'pending', 1, 0)
      `).run(ids.artId, ids.potId, `Moderated Product ${makeUnique('admin')}`, 'Moderated product', 33, 4).lastInsertRowid;

      const approveProduct = await agent.post(`/admin/products/${pendingProductId}/approve`);
      expect(approveProduct.statusCode).toBe(302);
      expect(approveProduct.headers.location).toContain('/admin/products');

      const rejectProduct = await agent.post(`/admin/products/${pendingProductId}/reject`);
      expect(rejectProduct.statusCode).toBe(302);
      expect(rejectProduct.headers.location).toContain('/admin/products');

      const toggleFeatured = await agent.post(`/admin/products/${ids.vaseId}/featured`);
      expect(toggleFeatured.statusCode).toBe(302);
      expect(toggleFeatured.headers.location).toContain('/admin/products');

      const orderStatus = await agent.post(`/admin/orders/${ids.orderId}/status`).send({ status: 'processing' });
      expect(orderStatus.statusCode).toBe(302);
      expect(orderStatus.headers.location).toContain(`/admin/orders/${ids.orderId}`);
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('delivered', ids.orderId);

      const tempAuctionProductId = db.prepare(`
        INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active)
        VALUES (?, ?, ?, ?, ?, ?, '[]', 'approved', 1)
      `).run(ids.artId, ids.potId, `Admin Auction Product ${makeUnique('admin')}`, 'Auction product', 60, 2).lastInsertRowid;
      const tempAuctionId = db.prepare(`
        INSERT INTO auctions (product_id, artisan_id, title, starting_price, current_highest_bid, bid_increment, start_time, end_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `).run(
        tempAuctionProductId,
        ids.artId,
        `Admin Cancel Auction ${makeUnique('admin')}`,
        50,
        50,
        2,
        new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        new Date(Date.now() + 60 * 60 * 1000).toISOString()
      ).lastInsertRowid;

      const cancelAuction = await agent.post(`/admin/auctions/${tempAuctionId}/cancel`);
      expect(cancelAuction.statusCode).toBe(302);
      expect(cancelAuction.headers.location).toContain('/admin/auctions');

      const tempReviewId = db.prepare(`
        INSERT INTO reviews (product_id, user_id, order_id, rating, title, comment, is_approved)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run(ids.outOfStockId, ids.cust2Id, ids.orderId, 3, 'Admin review', 'Admin review body').lastInsertRowid;

      const reviewStatus = await agent.post(`/admin/reviews/${tempReviewId}/status`).send({ status: 'hidden' });
      expect(reviewStatus.statusCode).toBe(302);
      expect(reviewStatus.headers.location).toContain('/admin/reviews');

      const approveReview = await agent.post(`/admin/reviews/${tempReviewId}/approve`);
      expect(approveReview.statusCode).toBe(302);
      expect(approveReview.headers.location).toContain('/admin/reviews');

      const deleteReview = await agent.post(`/admin/reviews/${tempReviewId}/delete`);
      expect(deleteReview.statusCode).toBe(302);
      expect(deleteReview.headers.location).toContain('/admin/reviews');
    });

  });
};
