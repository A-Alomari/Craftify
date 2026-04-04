const request = require('supertest');

module.exports = ({ getTestContext }) => {
  let app;

  const createReqRes = (overrides = {}) => {
    const req = {
      query: {},
      body: {},
      params: {},
      ...overrides
    };

    const res = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      }
    };

    return { req, res };
  };

  beforeAll(() => {
    ({ app } = getTestContext());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('API Controller Direct Branch Coverage', () => {
    test('searchSuggestions maps structured suggestions and tolerates invalid product image JSON', () => {
      const apiController = require('../../controllers/apiController');
      const Product = require('../../models/Product');
      const Category = require('../../models/Category');
      const ArtisanProfile = require('../../models/ArtisanProfile');

      jest.spyOn(Product, 'findAll').mockReturnValue([
        {
          id: 101,
          name: 'Invalid Image Product',
          price: '19.99',
          images: '{bad-json'
        }
      ]);
      jest.spyOn(Category, 'findAll').mockReturnValue([
        { id: 11, name: 'Tea Pots' },
        { id: 12, name: 'Wood Art' }
      ]);
      jest.spyOn(ArtisanProfile, 'findAll').mockReturnValue([
        { user_id: 33, shop_name: 'Teak Works' }
      ]);

      const pair = createReqRes({ query: { q: 'Te' } });
      apiController.searchSuggestions(pair.req, pair.res);

      expect(pair.res.statusCode).toBe(200);
      expect(Array.isArray(pair.res.payload.suggestions)).toBe(true);
      expect(pair.res.payload.suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'product', id: 101, link: '/products/101' }),
          expect.objectContaining({ type: 'category', id: 11, link: '/products?category=11' }),
          expect.objectContaining({ type: 'artisan', id: 33, link: '/products/artisan/33' })
        ])
      );

      const productSuggestion = pair.res.payload.suggestions.find((entry) => entry.type === 'product');
      expect(productSuggestion.image).toBe('/images/placeholder-product.jpg');
    });

    test('searchSuggestions direct catch branch returns 500 with safe payload', () => {
      const apiController = require('../../controllers/apiController');
      const Product = require('../../models/Product');

      jest.spyOn(Product, 'findAll').mockImplementation(() => {
        throw new Error('forced api controller branch');
      });

      const pair = createReqRes({ query: { q: 'Te' } });
      apiController.searchSuggestions(pair.req, pair.res);

      expect(pair.res.statusCode).toBe(500);
      expect(pair.res.payload.suggestions).toEqual([]);
    });

    test('GET /api/search alias resolves to search suggestions endpoint', async () => {
      const response = await request(app).get('/api/search?q=Te');

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.suggestions)).toBe(true);
    });
  });
};
