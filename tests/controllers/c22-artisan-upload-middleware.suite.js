const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Artisan Controller and Upload Middleware Coverage', () => {
    test('Upload middleware in auth/admin/artisan routes accepts valid files and rejects invalid types', async () => {
      const adminAgent = await loginAs('admin@test.com', 'admin123');
      const artisanAgent = await loginAs('artisan@test.com', 'art123');

      const adminCategory = await adminAgent
        .post('/admin/categories')
        .field('name', `Upload Category ${makeUnique('upload')}`)
        .field('description', 'Valid upload file')
        .attach('image', Buffer.from('valid-admin-image'), { filename: 'admin.png', contentType: 'image/png' });
      expect([200, 302]).toContain(adminCategory.statusCode);

      const adminInvalidUpload = await adminAgent
        .post('/admin/categories')
        .field('name', `Bad Upload ${makeUnique('upload')}`)
        .field('description', 'Invalid file type')
        .attach('image', Buffer.from('not-an-image'), { filename: 'bad.txt', contentType: 'text/plain' });
      expect(adminInvalidUpload.statusCode).toBeGreaterThanOrEqual(400);

      const artisanValidUpload = await artisanAgent
        .post('/artisan/profile')
        .field('name', 'Artisan')
        .field('phone', '123123')
        .field('shop_name', 'Test Shop')
        .field('bio', 'Valid artisan upload')
        .field('return_policy', 'Policy')
        .attach('profile_image', Buffer.from('valid-artisan-image'), { filename: 'artisan.webp', contentType: 'image/webp' });
      expect([200, 302]).toContain(artisanValidUpload.statusCode);

      const artisanInvalidUpload = await artisanAgent
        .post('/artisan/profile')
        .field('name', 'Artisan')
        .field('phone', '123123')
        .field('shop_name', 'Test Shop')
        .field('bio', 'Invalid artisan upload')
        .field('return_policy', 'Policy')
        .attach('profile_image', Buffer.from('bad-artisan-file'), { filename: 'artisan.txt', contentType: 'text/plain' });
      expect(artisanInvalidUpload.statusCode).toBeGreaterThanOrEqual(400);

      const authEmail = `${makeUnique('auth_upload')}@test.com`;
      const authValidUpload = await request(app)
        .post('/auth/artisan-register')
        .field('name', 'Auth Upload Artisan')
        .field('email', authEmail)
        .field('password', 'artisan123')
        .field('confirm_password', 'artisan123')
        .field('shop_name', 'Auth Upload Shop')
        .field('bio', 'Auth upload bio')
        .field('return_policy', 'Auth policy')
        .attach('profile_image', Buffer.from('auth-valid-image'), { filename: 'auth.jpg', contentType: 'image/jpeg' });
      expect(authValidUpload.statusCode).toBe(302);
      expect(authValidUpload.headers.location).toContain('/auth/login');

      const authInvalidUpload = await request(app)
        .post('/auth/artisan-register')
        .field('name', 'Auth Bad Upload')
        .field('email', `${makeUnique('auth_bad_upload')}@test.com`)
        .field('password', 'artisan123')
        .field('confirm_password', 'artisan123')
        .field('shop_name', 'Auth Bad Shop')
        .attach('profile_image', Buffer.from('auth-invalid-file'), { filename: 'auth.txt', contentType: 'text/plain' });
      expect(authInvalidUpload.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
};
