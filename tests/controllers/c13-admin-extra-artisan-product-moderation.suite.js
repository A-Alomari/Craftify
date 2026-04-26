const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Admin Routes Additional Coverage', () => {
    test('Admin artisan and product moderation endpoints update records', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');
      const artisanEmail = `${makeUnique('pending_artisan')}@test.com`;
      const pendingArtisanId = db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)')
        .run('Pending Artisan', artisanEmail, 'hash', 'artisan', 'active').lastInsertRowid;
      db.prepare('INSERT INTO artisan_profiles (user_id,shop_name,bio,is_approved) VALUES (?,?,?,0)')
        .run(pendingArtisanId, 'Pending Shop', 'Pending bio');

      const approveArtisan = await agent
        .post(`/admin/artisans/${pendingArtisanId}/approve`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(approveArtisan.statusCode).toBe(200);
      expect(approveArtisan.body.success).toBe(true);
      expect(db.prepare('SELECT is_approved FROM artisan_profiles WHERE user_id = ?').get(pendingArtisanId).is_approved).toBe(1);

      const rejectArtisan = await agent
        .post(`/admin/artisans/${pendingArtisanId}/reject`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(rejectArtisan.statusCode).toBe(200);
      expect(rejectArtisan.body.success).toBe(true);
      expect(db.prepare('SELECT is_approved FROM artisan_profiles WHERE user_id = ?').get(pendingArtisanId).is_approved).toBe(0);

      const pendingProduct = db.prepare('SELECT id FROM products WHERE status = ? LIMIT 1').get('pending');
      expect(pendingProduct).toBeTruthy();

      const approveProduct = await agent
        .post(`/admin/products/${pendingProduct.id}/approve`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(approveProduct.statusCode).toBe(200);
      expect(approveProduct.body.success).toBe(true);
      expect(db.prepare('SELECT status FROM products WHERE id = ?').get(pendingProduct.id).status).toBe('approved');

      const rejectProduct = await agent
        .post(`/admin/products/${pendingProduct.id}/reject`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(rejectProduct.statusCode).toBe(200);
      expect(rejectProduct.body.success).toBe(true);
      expect(db.prepare('SELECT status FROM products WHERE id = ?').get(pendingProduct.id).status).toBe('rejected');

      const beforeFeatured = db.prepare('SELECT featured FROM products WHERE id = ?').get(ids.vaseId).featured;
      const toggleFeatured = await agent
        .post(`/admin/products/${ids.vaseId}/featured`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(toggleFeatured.statusCode).toBe(200);
      expect(toggleFeatured.body.success).toBe(true);
      const afterFeatured = db.prepare('SELECT featured FROM products WHERE id = ?').get(ids.vaseId).featured;
      expect(afterFeatured).toBe(beforeFeatured ? 0 : 1);

      await agent.post(`/admin/products/${ids.vaseId}/featured`).set('X-Requested-With', 'XMLHttpRequest');
    });

  });
};
