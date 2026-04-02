const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Product, Auction, and Order Controller Additional Coverage', () => {
    test('Product routes cover filters, category/artisan pages, search redirect, and non-approved products', async () => {
      const customerAgent = await loginAs('customer@test.com', 'cust123');

      const filteredProducts = await customerAgent.get(
        `/products?category=${ids.potId}&search=Test&min_price=10&max_price=100&featured=1&sort=newest&page=1`
      );
      expect(filteredProducts.statusCode).toBe(200);

      const byCategory = await request(app).get(`/products/category/${ids.potId}`);
      expect(byCategory.statusCode).toBe(200);

      const missingCategory = await request(app).get('/products/category/999999');
      expect(missingCategory.statusCode).toBe(302);
      expect(missingCategory.headers.location).toContain('/products');

      const byArtisan = await request(app).get(`/products/artisan/${ids.artId}`);
      expect(byArtisan.statusCode).toBe(200);

      const missingArtisan = await request(app).get('/products/artisan/999999');
      expect(missingArtisan.statusCode).toBe(302);
      expect(missingArtisan.headers.location).toContain('/products');

      const searchRedirect = await request(app).get('/products/search?q=hand made');
      expect(searchRedirect.statusCode).toBe(302);
      expect(searchRedirect.headers.location).toContain('/products?search=hand%20made');

      const nonApprovedProduct = db.prepare("SELECT id FROM products WHERE status != 'approved' LIMIT 1").get();
      expect(nonApprovedProduct).toBeTruthy();

      const blockedProduct = await request(app).get(`/products/${nonApprovedProduct.id}`);
      expect(blockedProduct.statusCode).toBe(302);
      expect(blockedProduct.headers.location).toContain('/products');
    });

  });
};
