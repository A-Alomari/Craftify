module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  function uniqueValue(prefix) {
    return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  }

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Category/Coupon/User/Notification helper methods', () => {
    const Category = require('../../models/Category');
    const Coupon = require('../../models/Coupon');
    const User = require('../../models/User');
    const Notification = require('../../models/Notification');

    test('Category create/update/find/delete helpers work', () => {
      const created = Category.create({
        name: uniqueValue('Category'),
        description: 'Temporary category'
      });
      expect(created).toBeTruthy();

      const bySlug = Category.findBySlug(created.slug);
      expect(bySlug).toBeTruthy();

      const byName = Category.findByName(created.name);
      expect(byName).toBeTruthy();

      const updated = Category.update(created.id, { description: 'Updated category' });
      expect(updated.description).toBe('Updated category');

      const withProducts = Category.getWithProducts(2);
      expect(Array.isArray(withProducts)).toBe(true);

      Category.delete(created.id);
      expect(Category.findById(created.id)).toBeUndefined();
    });

    test('Coupon create/update/toggle/use/delete helpers work', () => {
      const code = uniqueValue('CPN').toUpperCase();
      const created = Coupon.create({
        code,
        description: 'Temp coupon',
        discount_type: 'percent',
        discount_value: 15,
        min_purchase: 10,
        usage_limit: 5
      });
      expect(created).toBeTruthy();

      const updated = Coupon.update(created.id, { description: 'Updated coupon' });
      expect(updated.description).toBe('Updated coupon');

      const toggled = Coupon.toggleActive(created.id);
      expect(toggled).toBeTruthy();

      Coupon.use(code);
      const afterUse = Coupon.findById(created.id);
      expect((afterUse.times_used || 0) + (afterUse.used_count || 0)).toBeGreaterThan(0);

      const activeOnly = Coupon.findAll({ active: true });
      expect(Array.isArray(activeOnly)).toBe(true);

      Coupon.delete(created.id);
      expect(Coupon.findById(created.id)).toBeUndefined();
    });

    test('User update/password/status/delete/stats methods work', async () => {
      const email = `${uniqueValue('user_extra')}@test.com`;
      const user = await User.create({
        name: 'Temp User',
        email,
        password: 'pass123',
        role: 'customer'
      });
      expect(user).toBeTruthy();

      const updated = User.update(user.id, { name: 'Temp User Updated', phone: '12345678' });
      expect(updated.name).toBe('Temp User Updated');

      await User.updatePassword(user.id, 'newpass123');
      const verified = await User.verifyPassword(email, 'newpass123');
      expect(verified).toBeTruthy();

      const statusUpdated = User.updateStatus(user.id, 'suspended');
      expect(statusUpdated.status).toBe('suspended');

      const stats = User.getStats();
      expect(stats).toHaveProperty('total');

      User.delete(user.id);
      expect(User.findById(user.id)).toBeUndefined();
    });

    test('Notification helper methods create expected notifications', () => {
      const baseCount = Notification.findByUserId(ids.custId).length;

      Notification.orderPlaced(ids.custId, ids.orderId);
      Notification.orderStatusChanged(ids.custId, ids.orderId, 'processing');
      Notification.newOrderForArtisan(ids.artId, ids.orderId);
      Notification.auctionOutbid(ids.custId, ids.auctionId, 'Test Auction');
      Notification.auctionWon(ids.custId, ids.auctionId, 'Test Auction', 99.5);
      Notification.auctionEnded(ids.artId, ids.auctionId, 'Test Auction', true);
      Notification.newReview(ids.artId, 'Test Vase', 5);
      Notification.newMessage(ids.custId, 'Artisan');
      Notification.productApproved(ids.artId, 'Test Vase');
      Notification.productRejected(ids.artId, 'Test Vase');
      Notification.artisanApproved(ids.artId);

      const afterCount = Notification.findByUserId(ids.custId).length;
      expect(afterCount).toBeGreaterThan(baseCount);
    });
  });
};


