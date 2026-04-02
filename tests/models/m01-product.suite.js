module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Product Model', () => {
    const Product = require('../../models/Product');

    test('findById returns a product with full details', () => {
      const p = Product.findById(ids.vaseId);
      expect(p).toBeTruthy();
      expect(p.name).toBe('Test Vase');
      expect(p.price).toBe(45.00);
      expect(p.shop_name).toBe('Test Shop');
      expect(p.category_name).toBe('Pottery');
    });

    test('findById returns undefined for non-existent product', () => {
      const p = Product.findById(99999);
      expect(p).toBeUndefined();
    });

    test('findAll with status filter returns only approved products', () => {
      const products = Product.findAll({ status: 'approved' });
      expect(products.length).toBeGreaterThanOrEqual(3);
      products.forEach(p => expect(p.status).toBe('approved'));
    });

    test('findAll with category filter', () => {
      const products = Product.findAll({ status: 'approved', category_id: ids.potId });
      expect(products.length).toBeGreaterThanOrEqual(1);
      products.forEach(p => expect(p.category_id).toBe(ids.potId));
    });

    test('findAll with search filter', () => {
      const products = Product.findAll({ search: 'Vase' });
      expect(products.length).toBeGreaterThanOrEqual(1);
      expect(products[0].name).toContain('Vase');
    });

    test('findAll with price filter', () => {
      const products = Product.findAll({ minPrice: 40, maxPrice: 50 });
      products.forEach(p => {
        expect(p.price).toBeGreaterThanOrEqual(40);
        expect(p.price).toBeLessThanOrEqual(50);
      });
    });

    test('count returns correct count', () => {
      const count = Product.count({ status: 'approved' });
      expect(count).toBeGreaterThanOrEqual(3);
    });

    test('getFeatured returns featured products', () => {
      const featured = Product.getFeatured(10);
      expect(featured.length).toBeGreaterThanOrEqual(1);
    });

    test('create a new product', () => {
      Product.create({ artisan_id: ids.artId, category_id: ids.potId, name: 'Unique Bowl Test', description: 'A new bowl', price: 55.00, stock: 3 });
      const found = Product.findAll({search: 'Unique Bowl Test'})[0];
      expect(found).toBeTruthy();
      expect(found.name).toBe('Unique Bowl Test');
    });

    test('update a product', () => {
      const p = Product.update(ids.vaseId, { price: 50.00 });
      expect(p.price).toBe(50.00);
      // Restore original price
      Product.update(ids.vaseId, { price: 45.00 });
    });

    test('incrementViews increases view count', () => {
      const before = Product.findById(ids.vaseId);
      Product.incrementViews(ids.vaseId);
      const after = Product.findById(ids.vaseId);
      expect(after.views).toBe(before.views + 1);
    });

    test('getRelated returns related products', () => {
      const related = Product.getRelated(ids.vaseId, 4);
      expect(Array.isArray(related)).toBe(true);
    });
  });

  // ── User Model ──
};


