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
  describe('ArtisanProfile Model', () => {
    const ArtisanProfile = require('../../models/ArtisanProfile');

    test('findByUserId and findById return artisan profile', () => {
      const profileByUser = ArtisanProfile.findByUserId(ids.artId);
      expect(profileByUser).toBeTruthy();
      expect(profileByUser.shop_name).toBe('Test Shop');

      const profileById = ArtisanProfile.findById(profileByUser.id);
      expect(profileById).toBeTruthy();
      expect(profileById.user_id).toBe(ids.artId);
    });

    test('create, update, approve, reject flow works', () => {
      const email = `${uniqueValue('artisan_extra')}@test.com`;
      const userInsert = db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)')
        .run('Extra Artisan', email, 'hashed', 'artisan', 'active');
      const artisanUserId = userInsert.lastInsertRowid;

      const created = ArtisanProfile.create({
        user_id: artisanUserId,
        shop_name: 'Extra Shop',
        bio: 'Extra bio'
      });
      expect(created).toBeTruthy();
      expect(created.shop_name).toBe('Extra Shop');

      const updated = ArtisanProfile.update(artisanUserId, { shop_name: 'Renamed Shop', bio: 'Updated bio' });
      expect(updated.shop_name).toBe('Renamed Shop');

      ArtisanProfile.approve(artisanUserId);
      const approved = ArtisanProfile.findByUserId(artisanUserId);
      expect(approved.is_approved).toBe(1);

      ArtisanProfile.reject(artisanUserId);
      const rejected = ArtisanProfile.findByUserId(artisanUserId);
      expect(rejected.is_approved).toBe(0);
    });

    test('findAll, count, featured and stats return expected shapes', () => {
      const all = ArtisanProfile.findAll({ search: 'Test' });
      expect(Array.isArray(all)).toBe(true);

      const approved = ArtisanProfile.findAll({ approved: true });
      expect(Array.isArray(approved)).toBe(true);

      const countApproved = ArtisanProfile.count({ approved: true });
      expect(typeof countApproved).toBe('number');

      const featured = ArtisanProfile.getFeatured(3);
      expect(Array.isArray(featured)).toBe(true);

      const stats = ArtisanProfile.getStats(ids.artId);
      expect(stats).toBeTruthy();
      expect(stats).toHaveProperty('total_products');
      expect(stats).toHaveProperty('total_orders');
    });
  });

};


