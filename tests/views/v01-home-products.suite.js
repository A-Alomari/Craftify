const request = require('supertest');

module.exports = ({ getTestContext, loginAs }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Homepage shows dynamic data', () => {
    test('Homepage contains product names from database', async () => {
      const res = await request(app).get('/');
      const html = res.text;
      // Should contain at least one featured product name
      const featured = db.prepare("SELECT name FROM products WHERE featured=1 AND status='approved' LIMIT 1").get();
      if (featured) {
        expect(html).toContain(featured.name);
      }
    });

    test('Homepage contains category names from database', async () => {
      const res = await request(app).get('/');
      const html = res.text;
      expect(html).toContain('Pottery');
      expect(html).toContain('Jewelry');
    });

    test('Homepage newsletter form posts to /subscribe', async () => {
      const res = await request(app).get('/');
      const html = res.text;
      expect(html).toContain('action="/subscribe"');
      expect(html).toContain('name="email"');
    });
  });

  describe('Products page shows dynamic data', () => {
    test('Products page contains product names from database', async () => {
      const res = await request(app).get('/products');
      const html = res.text;
      expect(html).toContain('Test Vase');
      expect(html).toContain('Test Ring');
    });

    test('Products page contains real prices', async () => {
      const res = await request(app).get('/products');
      const html = res.text;
      expect(html).toContain('45.00');
      expect(html).toContain('85.00');
    });

    test('Products page contains artisan shop names', async () => {
      const res = await request(app).get('/products');
      const html = res.text;
      expect(html).toContain('Test Shop');
    });

    test('Product detail page shows correct data', async () => {
      const res = await request(app).get(`/products/${ids.vaseId}`);
      const html = res.text;
      expect(html).toContain('Test Vase');
      expect(html).toContain('A beautiful test vase');
      expect(html).toContain('Pottery');
    });

    test('Product detail page shows stock info', async () => {
      const res = await request(app).get(`/products/${ids.vaseId}`);
      const html = res.text;
      expect(html).toContain('in stock');
    });

    test('Product detail wishlist control targets wishlist route', async () => {
      const res = await request(app).get(`/products/${ids.vaseId}`);
      expect(res.text).toContain('formaction="/user/wishlist/toggle"');
    });
  });

  describe('Auction page shows dynamic data', () => {
    test('Auction list shows auction titles', async () => {
      const res = await request(app).get('/auctions');
      const html = res.text;
      expect(html).toContain('Test Auction');
    });

    test('Auction detail shows bid data', async () => {
      const aId = db.prepare('SELECT id FROM auctions WHERE title = ?').get('Test Auction').id;
      const res = await request(app).get(`/auctions/${aId}`);
      const html = res.text;
      expect(html).toContain('Test Auction');
    });
  });

};

