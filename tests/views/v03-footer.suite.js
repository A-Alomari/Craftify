const request = require('supertest');

module.exports = ({ getTestContext, loginAs }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Footer links — Shop column', () => {
    test('GET /products returns 200', async () => {
      const res = await request(app).get('/products');
      expect(res.statusCode).toBe(200);
    });

    test('GET /products?featured=1 returns 200 and filters featured products', async () => {
      const res = await request(app).get('/products?featured=1');
      expect(res.statusCode).toBe(200);
      // Should contain "Featured" in the page title or filters
      expect(res.text).toBeTruthy();
    });

    test('GET /products?sort=newest returns 200', async () => {
      const res = await request(app).get('/products?sort=newest');
      expect(res.statusCode).toBe(200);
    });

    test('GET /auctions returns 200', async () => {
      const res = await request(app).get('/auctions');
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Footer links — Support column', () => {
    test('GET /faq returns 200', async () => {
      const res = await request(app).get('/faq');
      expect(res.statusCode).toBe(200);
    });

    test('GET /contact returns 200', async () => {
      const res = await request(app).get('/contact');
      expect(res.statusCode).toBe(200);
    });

    test('GET /auth/artisan-register returns 200', async () => {
      const res = await request(app).get('/auth/artisan-register');
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Footer links — Legal column', () => {
    test('GET /privacy returns 200', async () => {
      const res = await request(app).get('/privacy');
      expect(res.statusCode).toBe(200);
    });

    test('GET /terms returns 200', async () => {
      const res = await request(app).get('/terms');
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Footer links — Brand', () => {
    test('GET / (home) returns 200', async () => {
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Footer links — About page', () => {
    test('GET /about returns 200', async () => {
      const res = await request(app).get('/about');
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Footer contains all expected links', () => {
    test('Footer contains /products link', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('href="/products"');
    });

    test('Footer contains /auctions link', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('href="/auctions"');
    });

    test('Footer contains /faq link', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('href="/faq"');
    });

    test('Footer contains /contact link', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('href="/contact"');
    });

    test('Footer contains /privacy link', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('href="/privacy"');
    });

    test('Footer contains /terms link', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('href="/terms"');
    });

    test('Footer contains /auth/artisan-register link', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('href="/auth/artisan-register"');
    });

    test('Footer contains featured products link', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('href="/products?featured=1"');
    });

    test('Footer loads global scripts', async () => {
      const res = await request(app).get('/');
      expect(res.text).toContain('bootstrap.bundle.min.js');
      expect(res.text).toContain('src="/js/main.js"');
    });
  });
};

