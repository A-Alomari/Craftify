const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('User Controller Extra Validation and Catch Coverage', () => {
    test('User non-XHR validation and success branches are covered', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');

      const wrongCurrent = await agent.post('/user/change-password').send({
        current_password: 'wrong-current',
        new_password: 'abcdef123',
        confirm_password: 'abcdef123'
      });
      expect(wrongCurrent.statusCode).toBe(302);
      expect(wrongCurrent.headers.location).toContain('/user/profile');

      const shortPassword = await agent.post('/user/change-password').send({
        current_password: 'cust123',
        new_password: '123',
        confirm_password: '123'
      });
      expect(shortPassword.statusCode).toBe(302);
      expect(shortPassword.headers.location).toContain('/user/profile');

      const profileWithAvatar = await agent
        .post('/user/profile')
        .field('name', 'Customer')
        .field('phone', '12345678')
        .field('shipping_address', '123 Main St')
        .attach('avatar', Buffer.from('avatar-file'), { filename: 'avatar.jpg', contentType: 'image/jpeg' });
      expect(profileWithAvatar.statusCode).toBe(302);
      expect(profileWithAvatar.headers.location).toContain('/user/profile');

      db.prepare('INSERT OR IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)').run(ids.custId, ids.ringId);
      const wishlistPage = await agent.get('/user/wishlist');
      expect(wishlistPage.statusCode).toBe(200);

      const addWishlist = await agent.post('/user/wishlist/add').send({ productId: ids.vaseId });
      expect(addWishlist.statusCode).toBe(302);
      expect(addWishlist.headers.location).toContain('/products');

      const toggleWishlist = await agent.post('/user/wishlist/toggle').send({ productId: ids.vaseId });
      expect(toggleWishlist.statusCode).toBe(302);
      expect(toggleWishlist.headers.location).toContain('/products');

      const removeWishlist = await agent.post('/user/wishlist/remove').send({ productId: ids.ringId });
      expect(removeWishlist.statusCode).toBe(302);
      expect(removeWishlist.headers.location).toContain('/user/wishlist');

      await agent.post('/user/wishlist/add').send({ productId: ids.ringId });
      const moveWishlist = await agent.post('/user/wishlist/move-to-cart').send({ productId: ids.ringId });
      expect(moveWishlist.statusCode).toBe(302);
      expect(moveWishlist.headers.location).toContain('/user/wishlist');

      const reviewProductId = db.prepare(`
        INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active)
        VALUES (?, ?, ?, ?, ?, ?, '[]', 'approved', 1)
      `).run(
        ids.artId,
        ids.potId,
        `User Review Product ${makeUnique('user')}`,
        'Review product',
        21,
        3
      ).lastInsertRowid;

      const reviewOrderId = db.prepare(`
        INSERT INTO orders (
          user_id, subtotal, shipping_cost, discount_amount, total_amount,
          status, payment_method, payment_status, shipping_address, shipping_city, shipping_country
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(ids.custId, 21, 0, 0, 21, 'delivered', 'card', 'paid', 'Road 88', 'Manama', 'Bahrain').lastInsertRowid;

      db.prepare(`
        INSERT INTO order_items (order_id, product_id, artisan_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(reviewOrderId, reviewProductId, ids.artId, 1, 21, 21);

      const invalidReview = await agent.post('/user/reviews').send({
        product_id: reviewProductId,
        order_id: reviewOrderId,
        rating: 5,
        title: 'x'.repeat(220),
        comment: 'Invalid title length'
      });
      expect(invalidReview.statusCode).toBe(302);

      const validReview = await agent.post('/user/reviews').send({
        product_id: reviewProductId,
        order_id: reviewOrderId,
        rating: 4,
        title: 'Valid review',
        comment: 'This should pass'
      });
      expect(validReview.statusCode).toBe(302);
      expect(validReview.headers.location).toContain(`/products/${reviewProductId}`);

      const createdReview = db.prepare('SELECT id FROM reviews WHERE user_id = ? AND product_id = ? ORDER BY id DESC').get(ids.custId, reviewProductId);
      expect(createdReview).toBeTruthy();

      const deleteReview = await agent.post(`/user/reviews/${createdReview.id}/delete`);
      expect(deleteReview.statusCode).toBe(302);
      expect(deleteReview.headers.location).toContain('/user/reviews');

      const notificationId = db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, is_read)
        VALUES (?, 'system', 'User Non-XHR', 'User non-xhr notification', 0)
      `).run(ids.custId).lastInsertRowid;

      const markRead = await agent.post(`/user/notifications/${notificationId}/read`);
      expect(markRead.statusCode).toBe(302);
      expect(markRead.headers.location).toContain('/user/notifications');

      const markAllRead = await agent.post('/user/notifications/read-all');
      expect(markAllRead.statusCode).toBe(302);
      expect(markAllRead.headers.location).toContain('/user/notifications');

      const deleteNotification = await agent.delete(`/user/notifications/${notificationId}`);
      expect(deleteNotification.statusCode).toBe(302);
      expect(deleteNotification.headers.location).toContain('/user/notifications');

      const invalidRecipient = await agent.post('/user/messages').send({ receiver_id: 'abc', content: 'Bad recipient' });
      expect(invalidRecipient.statusCode).toBe(302);
      expect(invalidRecipient.headers.location).toContain('/user/messages');

      const validRecipient = await agent.post('/user/messages').send({ receiver_id: ids.artId, content: 'Regular non-xhr message' });
      expect(validRecipient.statusCode).toBe(302);
      expect(validRecipient.headers.location).toContain(`/user/messages/${ids.artId}`);
    });

  });
};
