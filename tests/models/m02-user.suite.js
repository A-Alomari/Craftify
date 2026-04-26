module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('User Model', () => {
    const User = require('../../models/User');

    test('findByEmail returns user', () => {
      const u = User.findByEmail('customer@test.com');
      expect(u).toBeTruthy();
      expect(u.name).toBe('Customer');
      expect(u.role).toBe('customer');
    });

    test('findByEmail returns undefined for non-existent email', () => {
      const u = User.findByEmail('nonexistent@test.com');
      expect(u).toBeUndefined();
    });

    test('findById returns user', () => {
      const u = User.findById(ids.custId);
      expect(u).toBeTruthy();
      expect(u.email).toBe('customer@test.com');
    });

    test('create inserts a new user', () => {
      const u = User.create({ name: 'New User', email: 'new@test.com', password: 'hashed', role: 'customer' });
      expect(u).toBeTruthy();
    });

    test('duplicate email throws error', async () => {
      await expect(User.create({ name: 'Duplicate', email: 'customer@test.com', password: 'hashed', role: 'customer' })).rejects.toThrow();
    });
  });

  // ── Review Model ──
};


