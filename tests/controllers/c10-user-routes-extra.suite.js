const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('User Routes Additional Coverage', () => {
    test('POST /user/profile updates persisted profile fields', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');

      const updateRes = await agent.post('/user/profile').send({
        name: 'Customer Updated',
        phone: '111222333',
        shipping_address: 'Updated Address'
      });
      expect(updateRes.statusCode).toBe(302);

      const updated = db.prepare('SELECT name, phone, shipping_address FROM users WHERE id = ?').get(ids.custId);
      expect(updated.name).toBe('Customer Updated');
      expect(updated.phone).toBe('111222333');

      await agent.post('/user/profile').send({
        name: 'Customer',
        phone: null,
        shipping_address: '123 Main St'
      });
    });

    test('POST /user/change-password handles mismatch and success flows', async () => {
      const customerAgent = await loginAs('customer@test.com', 'cust123');
      const mismatch = await customerAgent.post('/user/change-password').send({
        current_password: 'cust123',
        new_password: 'newpass123',
        confirm_password: 'different'
      });
      expect(mismatch.statusCode).toBe(302);

      const customer2Agent = await loginAs('customer2@test.com', 'cust123');
      const changed = await customer2Agent.post('/user/change-password').send({
        current_password: 'cust123',
        new_password: 'newpass123',
        confirm_password: 'newpass123'
      });
      expect(changed.statusCode).toBe(302);

      const loginWithNew = await request(app).post('/auth/login').send({
        email: 'customer2@test.com',
        password: 'newpass123'
      });
      expect(loginWithNew.statusCode).toBe(302);

      const revertAgent = await loginAs('customer2@test.com', 'newpass123');
      const reverted = await revertAgent.post('/user/change-password').send({
        current_password: 'newpass123',
        new_password: 'cust123',
        confirm_password: 'cust123'
      });
      expect(reverted.statusCode).toBe(302);
    }, 15000);

    test('Wishlist routes add, toggle and move items to cart', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');

      const addRes = await agent.post('/user/wishlist/add').send({ productId: ids.vaseId });
      expect(addRes.statusCode).toBe(302);
      expect(db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(ids.custId, ids.vaseId)).toBeTruthy();

      const toggleRes = await agent.post('/user/wishlist/toggle').send({ productId: ids.vaseId });
      expect(toggleRes.statusCode).toBe(302);
      expect(db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').get(ids.custId, ids.vaseId)).toBeUndefined();

      await agent.post('/user/wishlist/remove').send({ productId: ids.ringId });
      await agent.post('/user/wishlist/add').send({ productId: ids.ringId });
      const moveRes = await agent.post('/user/wishlist/move-to-cart').send({ productId: ids.ringId });
      expect(moveRes.statusCode).toBe(302);

      const cartItem = db.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?').get(ids.custId, ids.ringId);
      expect(cartItem).toBeTruthy();
    });

    test('Review routes enforce ownership and purchase rules', async () => {
      const customer2Agent = await loginAs('customer2@test.com', 'cust123');

      const cannotReview = await customer2Agent.post('/user/reviews').send({
        product_id: ids.outOfStockId,
        rating: 5,
        title: 'Should fail',
        comment: 'I did not purchase this'
      });
      expect(cannotReview.statusCode).toBe(302);

      const existingReview = db.prepare('SELECT id FROM reviews WHERE user_id = ? LIMIT 1').get(ids.custId);
      const unauthorizedDelete = await customer2Agent.post(`/user/reviews/${existingReview.id}/delete`);
      expect(unauthorizedDelete.statusCode).toBe(302);
    });

    test('Notification routes mark and delete notifications', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');

      const createdId = db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, is_read)
        VALUES (?, 'system', 'Temp', 'Temp notification', 0)
      `).run(ids.custId).lastInsertRowid;

      const markRes = await agent.post(`/user/notifications/${createdId}/read`);
      expect(markRes.statusCode).toBe(302);
      expect(db.prepare('SELECT is_read FROM notifications WHERE id = ?').get(createdId).is_read).toBe(1);

      const markAllRes = await agent.post('/user/notifications/read-all');
      expect(markAllRes.statusCode).toBe(302);

      const deleteRes = await agent.delete(`/user/notifications/${createdId}`);
      expect([200, 302]).toContain(deleteRes.statusCode);
    });

    test('Message routes validate recipients and render conversation', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');

      const missingUser = await agent.get('/user/messages/999999');
      expect(missingUser.statusCode).toBe(302);

      const selfMessage = await agent.post('/user/messages').send({
        receiver_id: ids.custId,
        content: 'Hello self'
      });
      expect(selfMessage.statusCode).toBe(302);

      const sent = await agent.post('/user/messages').send({
        receiver_id: ids.artId,
        content: 'Hello artisan'
      });
      expect(sent.statusCode).toBe(302);

      const convo = await agent.get(`/user/messages/${ids.artId}`);
      expect(convo.statusCode).toBe(200);
    });

    test('Artisan public profile redirects for unapproved profile', async () => {
      const pendingArtisanUserId = db.prepare(`
        INSERT INTO users (name, email, password, role, status)
        VALUES (?, ?, ?, 'artisan', 'active')
      `).run(`Pending Artisan ${Date.now()}`, `pending_${Date.now()}@test.com`, 'hash').lastInsertRowid;

      db.prepare(`
        INSERT INTO artisan_profiles (user_id, shop_name, bio, location, is_approved)
        VALUES (?, ?, ?, ?, 0)
      `).run(pendingArtisanUserId, 'Pending Shop', 'Pending bio', 'Manama');

      const pendingRes = await request(app).get(`/user/artisan/${pendingArtisanUserId}`);
      expect(pendingRes.statusCode).toBe(302);

      const approvedRes = await request(app).get(`/user/artisan/${ids.artId}`);
      expect(approvedRes.statusCode).toBe(200);
    });
  });

};

