const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('User Controller Extra Validation and Catch Coverage', () => {
    test('User catch paths return safe json or redirects', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const User = require('../../models/User');
      const Wishlist = require('../../models/Wishlist');
      const Review = require('../../models/Review');
      const Notification = require('../../models/Notification');
      const Message = require('../../models/Message');
      const ArtisanProfile = require('../../models/ArtisanProfile');

      const updateProfileSpy = jest.spyOn(User, 'update').mockImplementation(() => {
        throw new Error('Forced user profile catch');
      });
      const updateProfileCatch = await agent.post('/user/profile').send({
        name: 'Customer',
        phone: '100',
        shipping_address: 'Road 1'
      });
      expect(updateProfileCatch.statusCode).toBe(302);
      expect(updateProfileCatch.headers.location).toContain('/user/profile');
      updateProfileSpy.mockRestore();

      const verifyPasswordSpy = jest.spyOn(User, 'verifyPassword').mockRejectedValue(new Error('Forced change password catch'));
      const changePasswordCatch = await agent.post('/user/change-password').send({
        current_password: 'cust123',
        new_password: 'abcdef123',
        confirm_password: 'abcdef123'
      });
      expect(changePasswordCatch.statusCode).toBe(302);
      expect(changePasswordCatch.headers.location).toContain('/user/profile');
      verifyPasswordSpy.mockRestore();

      const wishlistAddSpy = jest.spyOn(Wishlist, 'add').mockImplementation(() => {
        throw new Error('Forced add wishlist catch');
      });
      const addCatch = await agent.post('/user/wishlist/add').set('X-Requested-With', 'XMLHttpRequest').send({ productId: ids.vaseId });
      expect(addCatch.statusCode).toBe(500);
      expect(addCatch.body.success).toBe(false);
      wishlistAddSpy.mockRestore();

      const wishlistRemoveSpy = jest.spyOn(Wishlist, 'remove').mockImplementation(() => {
        throw new Error('Forced remove wishlist catch');
      });
      const removeCatch = await agent.post('/user/wishlist/remove').set('X-Requested-With', 'XMLHttpRequest').send({ productId: ids.vaseId });
      expect(removeCatch.statusCode).toBe(500);
      expect(removeCatch.body.success).toBe(false);
      wishlistRemoveSpy.mockRestore();

      const wishlistToggleSpy = jest.spyOn(Wishlist, 'toggle').mockImplementation(() => {
        throw new Error('Forced toggle wishlist catch');
      });
      const toggleCatch = await agent.post('/user/wishlist/toggle').set('X-Requested-With', 'XMLHttpRequest').send({ productId: ids.vaseId });
      expect(toggleCatch.statusCode).toBe(500);
      expect(toggleCatch.body.success).toBe(false);
      wishlistToggleSpy.mockRestore();

      const wishlistMoveSpy = jest.spyOn(Wishlist, 'moveToCart').mockImplementation(() => {
        throw new Error('Forced move wishlist catch');
      });
      const moveCatch = await agent.post('/user/wishlist/move-to-cart').set('X-Requested-With', 'XMLHttpRequest').send({ productId: ids.vaseId });
      expect(moveCatch.statusCode).toBe(500);
      expect(moveCatch.body.success).toBe(false);
      wishlistMoveSpy.mockRestore();

      const canReviewSpy = jest.spyOn(Review, 'canReview').mockReturnValue({ canReview: true, hasPurchased: true, hasReviewed: false });
      const createReviewSpy = jest.spyOn(Review, 'create').mockImplementation(() => {
        throw new Error('Forced create review catch');
      });
      const createReviewCatch = await agent.post('/user/reviews').set('X-Requested-With', 'XMLHttpRequest').send({
        product_id: ids.vaseId,
        rating: 5,
        title: 'Catch review',
        comment: 'Catch review body'
      });
      expect(createReviewCatch.statusCode).toBe(500);
      expect(createReviewCatch.body.success).toBe(false);
      createReviewSpy.mockRestore();
      canReviewSpy.mockRestore();

      const deleteFindSpy = jest.spyOn(Review, 'findById').mockReturnValue({ id: 99999, user_id: ids.custId });
      const deleteReviewSpy = jest.spyOn(Review, 'delete').mockImplementation(() => {
        throw new Error('Forced delete review catch');
      });
      const deleteReviewCatch = await agent.post('/user/reviews/99999/delete').set('X-Requested-With', 'XMLHttpRequest');
      expect(deleteReviewCatch.statusCode).toBe(500);
      expect(deleteReviewCatch.body.success).toBe(false);
      deleteReviewSpy.mockRestore();
      deleteFindSpy.mockRestore();

      const markNotificationSpy = jest.spyOn(Notification, 'markAsRead').mockImplementation(() => {
        throw new Error('Forced mark notification catch');
      });
      const markNotificationCatch = await agent.post('/user/notifications/1/read').set('X-Requested-With', 'XMLHttpRequest');
      expect(markNotificationCatch.statusCode).toBe(500);
      expect(markNotificationCatch.body.success).toBe(false);
      markNotificationSpy.mockRestore();

      const markAllSpy = jest.spyOn(Notification, 'markAllAsRead').mockImplementation(() => {
        throw new Error('Forced mark all catch');
      });
      const markAllCatch = await agent.post('/user/notifications/read-all').set('X-Requested-With', 'XMLHttpRequest');
      expect(markAllCatch.statusCode).toBe(500);
      expect(markAllCatch.body.success).toBe(false);
      markAllSpy.mockRestore();

      const deleteNotificationSpy = jest.spyOn(Notification, 'delete').mockImplementation(() => {
        throw new Error('Forced delete notification catch');
      });
      const deleteNotificationCatch = await agent.delete('/user/notifications/1').set('X-Requested-With', 'XMLHttpRequest');
      expect(deleteNotificationCatch.statusCode).toBe(500);
      expect(deleteNotificationCatch.body.success).toBe(false);
      deleteNotificationSpy.mockRestore();

      const threadSpy = jest.spyOn(Message, 'getThread').mockImplementation(() => {
        throw new Error('Forced conversation catch');
      });
      const conversationCatch = await agent.get(`/user/messages/${ids.artId}`);
      expect(conversationCatch.statusCode).toBe(302);
      expect(conversationCatch.headers.location).toContain('/user/messages');
      threadSpy.mockRestore();

      const sendMessageSpy = jest.spyOn(Message, 'create').mockImplementation(() => {
        throw new Error('Forced send message catch');
      });
      const sendMessageCatch = await agent.post('/user/messages').set('X-Requested-With', 'XMLHttpRequest').send({
        receiver_id: ids.artId,
        content: 'Catch message'
      });
      expect(sendMessageCatch.statusCode).toBe(500);
      expect(sendMessageCatch.body.success).toBe(false);
      sendMessageSpy.mockRestore();

      const artisanViewSpy = jest.spyOn(ArtisanProfile, 'findByUserId').mockImplementation(() => {
        throw new Error('Forced artisan view catch');
      });
      const artisanViewCatch = await agent.get(`/user/artisan/${ids.artId}`);
      expect(artisanViewCatch.statusCode).toBe(302);
      expect(artisanViewCatch.headers.location).toContain('/products');
      artisanViewSpy.mockRestore();
    });
  });
};
