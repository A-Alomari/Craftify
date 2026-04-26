const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Auth Routes', () => {
    test('POST /auth/login with valid credentials redirects', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'customer@test.com', password: 'cust123' });
      expect(res.statusCode).toBe(302);
    });

    test('POST /auth/login with wrong password redirects back to login', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'customer@test.com', password: 'wrongpass' });
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('login');
    });

    test('POST /auth/login with suspended account is rejected', async () => {
      const res = await request(app).post('/auth/login').send({ email: 'suspended@test.com', password: 'susp123' });
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('login');
    });

    test('POST /auth/register creates new user', async () => {
      const email = 'user_' + Date.now() + '@test.com';
      const res = await request(app).post('/auth/register').send({
        name: 'Test Registration',
        email: email,
        password: 'pass123',
        confirmPassword: 'pass123'
      });
      expect(res.statusCode).toBe(302);
    });

    test('POST /auth/register with duplicate email fails', async () => {
      const res = await request(app).post('/auth/register').send({
        name: 'Dup',
        email: 'customer@test.com',
        password: 'pass123',
        confirmPassword: 'pass123'
      });
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain('register');
    });

    test('GET /auth/logout redirects to home', async () => {
      const agent = await loginAs('customer@test.com', 'cust123');
      const res = await agent.get('/auth/logout');
      expect(res.statusCode).toBe(302);
    });
  });

  // ── Customer Routes ──
};

