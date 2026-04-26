module.exports = () => {
  describe('Utility helpers', () => {
    test('redirect helper blocks newline and cross-host redirects', () => {
      const { isSafeRelativePath, getSafeRedirect } = require('../../utils/redirect');

      expect(isSafeRelativePath('/safe/path')).toBe(true);
      expect(isSafeRelativePath('/unsafe\rpath')).toBe(false);
      expect(isSafeRelativePath('/unsafe\npath')).toBe(false);
      expect(isSafeRelativePath('//double-slash')).toBe(false);

      const safeReq = {
        get: jest.fn((header) => {
          if (header === 'Referrer') return '/products?page=1';
          if (header === 'host') return 'localhost:3000';
          return undefined;
        })
      };
      expect(getSafeRedirect(safeReq, '/fallback')).toBe('/products?page=1');

      const crossHostReq = {
        get: jest.fn((header) => {
          if (header === 'Referrer') return 'https://evil.example/products';
          if (header === 'host') return 'localhost:3000';
          return undefined;
        })
      };
      expect(getSafeRedirect(crossHostReq, '/fallback')).toBe('/fallback');

      const newlineReq = {
        get: jest.fn((header) => {
          if (header === 'Referrer') return '/cart\r\nSet-Cookie:bad=1';
          if (header === 'host') return 'localhost:3000';
          return undefined;
        })
      };
      expect(getSafeRedirect(newlineReq, '/fallback')).toBe('/fallback');
    });
  });
};
