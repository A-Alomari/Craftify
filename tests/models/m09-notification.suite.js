module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Notification Model', () => {
    const Notification = require('../../models/Notification');

    test('getUserNotifications returns notifications', () => {
      const notifs = Notification.findByUserId(ids.custId);
      expect(notifs.length).toBeGreaterThanOrEqual(1);
    });

    test('getUnreadCount returns count', () => {
      const count = Notification.getUnreadCount(ids.custId);
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });
};


