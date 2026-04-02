const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('User Controller Branch Coverage', () => {
    test('User pages and XHR handlers for reviews, notifications, and messages', async () => {
      const agent = await loginAs('customer2@test.com', 'cust123');

      const reviewsPage = await agent.get('/user/reviews');
      expect(reviewsPage.statusCode).toBe(200);

      const messagesPage = await agent.get('/user/messages');
      expect(messagesPage.statusCode).toBe(200);

      const tempProductId = db.prepare(`
        INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active)
        VALUES (?, ?, ?, ?, ?, ?, '[]', 'approved', 1)
      `).run(
        ids.artId,
        ids.potId,
        `Review Branch Product ${makeUnique('user')}`,
        'Review branch product',
        25,
        5
      ).lastInsertRowid;

      const tempOrderId = db.prepare(`
        INSERT INTO orders (
          user_id, subtotal, shipping_cost, discount_amount, total_amount,
          status, payment_method, payment_status, shipping_address, shipping_city, shipping_country
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(ids.cust2Id, 25, 0, 0, 25, 'delivered', 'card', 'paid', 'Road 777', 'Manama', 'Bahrain').lastInsertRowid;

      db.prepare(`
        INSERT INTO order_items (order_id, product_id, artisan_id, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(tempOrderId, tempProductId, ids.artId, 1, 25, 25);

      const invalidReview = await agent
        .post('/user/reviews')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          product_id: tempProductId,
          order_id: tempOrderId,
          rating: 5,
          title: 'x'.repeat(205),
          comment: 'Invalid because title is too long'
        });
      expect(invalidReview.statusCode).toBe(400);
      expect(invalidReview.body.success).toBe(false);

      const createdReview = await agent
        .post('/user/reviews')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({
          product_id: tempProductId,
          order_id: tempOrderId,
          rating: 4,
          title: 'Valid title',
          comment: 'Valid comment'
        });
      expect(createdReview.statusCode).toBe(200);
      expect(createdReview.body.success).toBe(true);
      expect(createdReview.body.review).toBeTruthy();

      const deletedReview = await agent
        .post(`/user/reviews/${createdReview.body.review.id}/delete`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(deletedReview.statusCode).toBe(200);
      expect(deletedReview.body.success).toBe(true);

      const notifId = db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, is_read)
        VALUES (?, 'system', 'User Branch', 'User branch notification', 0)
      `).run(ids.cust2Id).lastInsertRowid;

      const markOne = await agent
        .post(`/user/notifications/${notifId}/read`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(markOne.statusCode).toBe(200);
      expect(markOne.body.success).toBe(true);

      const markAll = await agent
        .post('/user/notifications/read-all')
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(markAll.statusCode).toBe(200);
      expect(markAll.body.success).toBe(true);

      const deleteNotif = await agent
        .delete(`/user/notifications/${notifId}`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(deleteNotif.statusCode).toBe(200);
      expect(deleteNotif.body.success).toBe(true);

      const invalidRecipient = await agent
        .post('/user/messages')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ receiver_id: 'abc', content: 'Invalid recipient branch' });
      expect(invalidRecipient.statusCode).toBe(400);
      expect(invalidRecipient.body.success).toBe(false);

      const selfRecipient = await agent
        .post('/user/messages')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ receiver_id: ids.cust2Id, content: 'Self message branch' });
      expect(selfRecipient.statusCode).toBe(400);
      expect(selfRecipient.body.success).toBe(false);

      const sentMessage = await agent
        .post('/user/messages')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ receiver_id: ids.artId, content: 'XHR message branch' });
      expect(sentMessage.statusCode).toBe(200);
      expect(sentMessage.body.success).toBe(true);
      expect(sentMessage.body.message).toBeTruthy();
    });

  });
};
