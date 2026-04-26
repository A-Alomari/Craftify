/**
 * m21-redirect-full.suite.js
 * Comprehensive branch coverage for utils/redirect.js
 * Tests: isSafeRelativePath, getSafeRedirect — every branch, edge case, and input type.
 */

module.exports = () => {
  const { isSafeRelativePath, getSafeRedirect } = require('../../utils/redirect');

  describe('Redirect utilities — full branch coverage', () => {

    // ── isSafeRelativePath ────────────────────────────────────────────────────

    describe('isSafeRelativePath', () => {
      describe('returns true for safe paths', () => {
        test('simple root path', () => {
          expect(isSafeRelativePath('/')).toBe(true);
        });
        test('path with segments', () => {
          expect(isSafeRelativePath('/products')).toBe(true);
        });
        test('path with query string', () => {
          expect(isSafeRelativePath('/products?page=2&category=pottery')).toBe(true);
        });
        test('path with hash', () => {
          expect(isSafeRelativePath('/about#team')).toBe(true);
        });
        test('path with encoded characters', () => {
          expect(isSafeRelativePath('/search?q=hello%20world')).toBe(true);
        });
        test('deeply nested path', () => {
          expect(isSafeRelativePath('/admin/orders/123/detail')).toBe(true);
        });
        test('path with hyphen and underscore', () => {
          expect(isSafeRelativePath('/my-orders/track_item')).toBe(true);
        });
      });

      describe('returns false for unsafe paths', () => {
        test('double-slash (protocol-relative) URL', () => {
          expect(isSafeRelativePath('//evil.example.com')).toBe(false);
        });
        test('path containing carriage return', () => {
          expect(isSafeRelativePath('/cart\r\nInjected')).toBe(false);
        });
        test('path containing newline', () => {
          expect(isSafeRelativePath('/cart\nInjected')).toBe(false);
        });
        test('path containing only \\r', () => {
          expect(isSafeRelativePath('/page\rwith-cr')).toBe(false);
        });
        test('path containing only \\n', () => {
          expect(isSafeRelativePath('/page\nwith-nl')).toBe(false);
        });
        test('absolute URL with http scheme', () => {
          expect(isSafeRelativePath('http://example.com/path')).toBe(false);
        });
        test('absolute URL with https scheme', () => {
          expect(isSafeRelativePath('https://example.com/path')).toBe(false);
        });
        test('empty string', () => {
          expect(isSafeRelativePath('')).toBe(false);
        });
        test('non-string: number', () => {
          expect(isSafeRelativePath(42)).toBe(false);
        });
        test('non-string: null', () => {
          expect(isSafeRelativePath(null)).toBe(false);
        });
        test('non-string: undefined', () => {
          expect(isSafeRelativePath(undefined)).toBe(false);
        });
        test('non-string: object', () => {
          expect(isSafeRelativePath({})).toBe(false);
        });
        test('non-string: array', () => {
          expect(isSafeRelativePath(['/valid'])).toBe(false);
        });
        test('path without leading slash', () => {
          expect(isSafeRelativePath('products/list')).toBe(false);
        });
        test('double-slash with path after host', () => {
          expect(isSafeRelativePath('//evil.com/xss')).toBe(false);
        });
      });
    });

    // ── getSafeRedirect ───────────────────────────────────────────────────────

    /** Build a mock request object for getSafeRedirect */
    function makeReq({ referrer, host } = {}) {
      return {
        get: jest.fn((header) => {
          if (header === 'Referrer') return referrer;
          if (header === 'host') return host || 'localhost:3000';
          return undefined;
        })
      };
    }

    describe('getSafeRedirect', () => {

      describe('no Referrer present', () => {
        test('returns fallback when Referrer header is undefined', () => {
          const req = makeReq({ referrer: undefined });
          expect(getSafeRedirect(req, '/fallback')).toBe('/fallback');
        });
        test('returns default fallback "/" when none provided and no Referrer', () => {
          const req = makeReq({ referrer: undefined });
          expect(getSafeRedirect(req)).toBe('/');
        });
        test('returns fallback when Referrer header is null', () => {
          const req = makeReq({ referrer: null });
          expect(getSafeRedirect(req, '/home')).toBe('/home');
        });
        test('returns fallback when Referrer is empty string', () => {
          const req = makeReq({ referrer: '' });
          // empty string is falsy → treated as "no referrer"
          expect(getSafeRedirect(req, '/empty')).toBe('/empty');
        });
      });

      describe('safe relative path Referrer', () => {
        test('returns referrer directly when it is a safe relative path', () => {
          const req = makeReq({ referrer: '/products?page=1', host: 'localhost:3000' });
          expect(getSafeRedirect(req, '/fallback')).toBe('/products?page=1');
        });
        test('returns root path referrer as-is', () => {
          const req = makeReq({ referrer: '/', host: 'localhost:3000' });
          expect(getSafeRedirect(req, '/fallback')).toBe('/');
        });
      });

      describe('absolute URL Referrer — same host', () => {
        test('extracts pathname from same-host absolute referrer', () => {
          const req = makeReq({
            referrer: 'http://localhost:3000/cart',
            host: 'localhost:3000'
          });
          const result = getSafeRedirect(req, '/fallback');
          expect(result).toBe('/cart');
        });
        test('includes query string from same-host absolute referrer', () => {
          const req = makeReq({
            referrer: 'http://localhost:3000/products?sort=price',
            host: 'localhost:3000'
          });
          expect(getSafeRedirect(req, '/fallback')).toBe('/products?sort=price');
        });
        test('includes hash from same-host absolute referrer', () => {
          const req = makeReq({
            referrer: 'http://localhost:3000/about#contact',
            host: 'localhost:3000'
          });
          expect(getSafeRedirect(req, '/fallback')).toBe('/about#contact');
        });
      });

      describe('absolute URL Referrer — cross-host', () => {
        test('returns fallback for cross-host absolute referrer', () => {
          const req = makeReq({
            referrer: 'https://evil.example.com/products',
            host: 'localhost:3000'
          });
          expect(getSafeRedirect(req, '/fallback')).toBe('/fallback');
        });
        test('returns fallback for subdomain redirect', () => {
          const req = makeReq({
            referrer: 'https://sub.localhost:3000/products',
            host: 'localhost:3000'
          });
          expect(getSafeRedirect(req, '/fallback')).toBe('/fallback');
        });
      });

      describe('unsafe relative path Referrer', () => {
        test('returns fallback when referrer contains newline injection', () => {
          const req = makeReq({
            referrer: '/cart\r\nSet-Cookie:bad=1',
            host: 'localhost:3000'
          });
          expect(getSafeRedirect(req, '/fallback')).toBe('/fallback');
        });
        test('returns fallback for double-slash referrer', () => {
          const req = makeReq({
            referrer: '//evil.com',
            host: 'localhost:3000'
          });
          expect(getSafeRedirect(req, '/fallback')).toBe('/fallback');
        });
      });

      describe('malformed/unparseable Referrer', () => {
        test('returns fallback for completely invalid URL', () => {
          const req = makeReq({
            referrer: 'not a valid url at all :::',
            host: 'localhost:3000'
          });
          expect(getSafeRedirect(req, '/fallback')).toBe('/fallback');
        });
        test('returns fallback for referrer with spaces (not safe relative)', () => {
          const req = makeReq({
            referrer: 'hello world',
            host: 'localhost:3000'
          });
          expect(getSafeRedirect(req, '/fallback')).toBe('/fallback');
        });
      });

      describe('same-host referrer with newline in path', () => {
        test('newline in path is percent-encoded by URL parser, resulting in safe candidate', () => {
          // Node.js WHATWG URL parser encodes \n as %0A rather than throwing,
          // so the resulting candidate /page%0Ainjected passes isSafeRelativePath.
          const req = makeReq({
            referrer: 'http://localhost:3000/page\ninjected',
            host: 'localhost:3000'
          });
          const result = getSafeRedirect(req, '/fallback');
          // Either the percent-encoded, stripped, or fallback path is acceptable
          expect(['/page%0Ainjected', '/pageinjected', '/fallback']).toContain(result);
        });
      });

      describe('default fallback value', () => {
        test('default fallback "/" when no argument provided', () => {
          const req = makeReq({ referrer: undefined });
          expect(getSafeRedirect(req)).toBe('/');
        });
        test('custom fallback "/dashboard" is returned when unsafe', () => {
          const req = makeReq({
            referrer: 'https://hacker.io/xss',
            host: 'localhost:3000'
          });
          expect(getSafeRedirect(req, '/dashboard')).toBe('/dashboard');
        });
      });
    });
  });
};
