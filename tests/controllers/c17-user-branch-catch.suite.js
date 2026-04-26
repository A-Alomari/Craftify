const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('User Controller Branch Coverage', () => {
    test('User controller catch handlers redirect or return safe JSON', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const Wishlist = require('../../models/Wishlist');
      const Review = require('../../models/Review');
      const Notification = require('../../models/Notification');
      const Message = require('../../models/Message');

      const wishlistSpy = jest.spyOn(Wishlist, 'findByUserId').mockImplementation(() => {
        throw new Error('Forced wishlist catch');
      });
      const wishlistFallback = await agent.get('/user/wishlist');
      expect(wishlistFallback.statusCode).toBe(302);
      expect(wishlistFallback.headers.location).toBe('/');
      wishlistSpy.mockRestore();

      const reviewsSpy = jest.spyOn(Review, 'findByUserId').mockImplementation(() => {
        throw new Error('Forced reviews catch');
      });
      const reviewsFallback = await agent.get('/user/reviews');
      expect(reviewsFallback.statusCode).toBe(302);
      expect(reviewsFallback.headers.location).toBe('/');
      reviewsSpy.mockRestore();

      const notificationsSpy = jest.spyOn(Notification, 'findByUserId').mockImplementation(() => {
        throw new Error('Forced notifications catch');
      });
      const notificationsFallback = await agent.get('/user/notifications');
      expect(notificationsFallback.statusCode).toBe(302);
      expect(notificationsFallback.headers.location).toBe('/');
      notificationsSpy.mockRestore();

      const conversationsSpy = jest.spyOn(Message, 'getConversations').mockImplementation(() => {
        throw new Error('Forced messages catch');
      });
      const messagesFallback = await agent.get('/user/messages');
      expect(messagesFallback.statusCode).toBe(302);
      expect(messagesFallback.headers.location).toBe('/');
      conversationsSpy.mockRestore();

      const sendSpy = jest.spyOn(Message, 'create').mockImplementation(() => {
        throw new Error('Forced send message catch');
      });
      const sendFallback = await agent
        .post('/user/messages')
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ receiver_id: ids.artId, content: 'Force send catch' });
      expect(sendFallback.statusCode).toBe(500);
      expect(sendFallback.body.success).toBe(false);
      sendSpy.mockRestore();
    });
  });
};
