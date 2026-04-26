module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Category Model', () => {
    const Category = require('../../models/Category');

    test('findAll returns categories', () => {
      const cats = Category.findAll();
      expect(cats.length).toBeGreaterThanOrEqual(2);
    });

    test('findById returns a category', () => {
      const cat = Category.findById(ids.potId);
      expect(cat).toBeTruthy();
      expect(cat.name).toBe('Pottery');
    });
  });

  // ── Cart Model ──
};


