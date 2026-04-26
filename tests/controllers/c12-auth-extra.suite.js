const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Auth Routes Additional Coverage', () => {
    test('Auth validation branches and artisan registration paths are covered', async () => {
      const missingLoginFields = await request(app).post('/auth/login').send({ email: '' });
      expect(missingLoginFields.statusCode).toBe(302);
      expect(missingLoginFields.headers.location).toContain('/auth/login');

      const invalidRegister = await request(app).post('/auth/register').send({
        name: 'Bad Register',
        email: 'invalid-email',
        password: '123',
        confirmPassword: '321'
      });
      expect(invalidRegister.statusCode).toBe(302);
      expect(invalidRegister.headers.location).toContain('/auth/register');

      const artisanPage = await request(app).get('/auth/artisan-register');
      expect(artisanPage.statusCode).toBe(200);

      const invalidArtisan = await request(app).post('/auth/artisan-register').send({
        name: 'Invalid Artisan',
        email: 'bad-email',
        password: '123',
        confirmPassword: '123',
        shop_name: ''
      });
      expect(invalidArtisan.statusCode).toBe(302);
      expect(invalidArtisan.headers.location).toContain('/auth/artisan-register');

      const artisanEmail = `${makeUnique('artisan_reg')}@test.com`;
      const artisanSuccess = await request(app).post('/auth/artisan-register').send({
        name: 'Registered Artisan',
        email: artisanEmail,
        password: 'artisan123',
        confirmPassword: 'artisan123',
        phone: '12345678',
        shop_name: 'Registered Shop',
        bio: 'Registered bio',
        return_policy: 'No return'
      });
      expect(artisanSuccess.statusCode).toBe(302);
      expect(artisanSuccess.headers.location).toContain('/auth/login');

      const createdArtisan = db.prepare('SELECT id FROM users WHERE email = ?').get(artisanEmail);
      expect(createdArtisan).toBeTruthy();
      const createdProfile = db.prepare('SELECT * FROM artisan_profiles WHERE user_id = ?').get(createdArtisan.id);
      expect(createdProfile).toBeTruthy();
    });

    test('Forgot/reset password covers unknown, valid, invalid, and success branches', async () => {
      const User = require('../../models/User');
      const resetEmail = `${makeUnique('reset_user')}@test.com`;
      const resetUser = await User.create({
        name: 'Reset User',
        email: resetEmail,
        password: 'oldpass123',
        role: 'customer'
      });

      const forgotPage = await request(app).get('/auth/forgot-password');
      expect(forgotPage.statusCode).toBe(200);

      const unknownEmail = await request(app).post('/auth/forgot-password').send({ email: `${makeUnique('none')}@test.com` });
      expect(unknownEmail.statusCode).toBe(302);

      const knownEmail = await request(app).post('/auth/forgot-password').send({ email: resetEmail });
      expect(knownEmail.statusCode).toBe(302);

      const tokenRow = db.prepare('SELECT token FROM password_resets WHERE user_id = ? ORDER BY id DESC').get(resetUser.id);
      expect(tokenRow).toBeTruthy();

      const validResetPage = await request(app).get(`/auth/reset-password/${tokenRow.token}`);
      expect(validResetPage.statusCode).toBe(200);

      const mismatch = await request(app).post(`/auth/reset-password/${tokenRow.token}`).send({
        password: 'newpass123',
        confirm_password: 'different'
      });
      expect(mismatch.statusCode).toBe(302);
      expect(mismatch.headers.location).toContain(`/auth/reset-password/${tokenRow.token}`);

      const tooShort = await request(app).post(`/auth/reset-password/${tokenRow.token}`).send({
        password: '123',
        confirm_password: '123'
      });
      expect(tooShort.statusCode).toBe(302);
      expect(tooShort.headers.location).toContain(`/auth/reset-password/${tokenRow.token}`);

      const success = await request(app).post(`/auth/reset-password/${tokenRow.token}`).send({
        password: 'newpass123',
        confirm_password: 'newpass123'
      });
      expect(success.statusCode).toBe(302);
      expect(success.headers.location).toContain('/auth/login');

      const usedToken = db.prepare('SELECT used FROM password_resets WHERE token = ?').get(tokenRow.token);
      expect(usedToken.used).toBe(1);

      const loginWithResetPassword = await request(app).post('/auth/login').send({
        email: resetEmail,
        password: 'newpass123'
      });
      expect(loginWithResetPassword.statusCode).toBe(302);

      const invalidResetPage = await request(app).get('/auth/reset-password/not-a-real-token');
      expect(invalidResetPage.statusCode).toBe(302);
      expect(invalidResetPage.headers.location).toContain('/auth/forgot-password');
    });
  });

};

