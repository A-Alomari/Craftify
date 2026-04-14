/**
 * m23-auth-middleware.suite.js
 * Full branch coverage for middleware/auth.js
 * Tests every middleware (isAuthenticated, isGuest, isCustomer, isCustomerOrGuest,
 * isArtisan, isAdmin, isApprovedArtisan, isActive, attachUser) using mock
 * req/res/next objects — no HTTP server required.
 */

module.exports = () => {
  describe('Auth Middleware — full branch coverage', () => {

    // We re-require fresh to avoid ArtisanProfile caching issues
    let middleware;
    beforeAll(() => {
      middleware = require('../../middleware/auth');
    });

    /** Build a mock response that records calls */
    function makeRes() {
      const res = {
        _status: null,
        _body: null,
        _redirect: null,
        _cookie: null,
        _json: null,
        status(code) { this._status = code; return this; },
        json(body) { this._json = body; return this; },
        redirect(url) { this._redirect = url; },
        clearCookie(name) { this._cookie = name; }
      };
      return res;
    }

    /** Build a mock request */
    function makeReq({ user, xhr, flash } = {}) {
      const flashes = {};
      return {
        session: user !== undefined ? { user } : {},
        xhr: xhr || false,
        flash: flash || function(key, val) { flashes[key] = val; },
        _flashes: flashes
      };
    }

    function makeNext() {
      const fn = jest.fn();
      return fn;
    }

    // ── isAuthenticated ───────────────────────────────────────────────────────

    describe('isAuthenticated', () => {
      test('calls next() when user is in session', () => {
        const req = makeReq({ user: { id: 1, role: 'customer' } });
        const res = makeRes();
        const next = makeNext();
        middleware.isAuthenticated(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res._redirect).toBeNull();
      });

      test('redirects to /auth/login when no user in session', () => {
        const req = makeReq({ user: undefined });
        const res = makeRes();
        const next = makeNext();
        middleware.isAuthenticated(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res._redirect).toBe('/auth/login');
      });

      test('flashes error message when unauthenticated', () => {
        const flashed = {};
        const req = { session: {}, flash: (k, v) => { flashed[k] = v; }, xhr: false };
        const res = makeRes();
        middleware.isAuthenticated(req, res, makeNext());
        expect(flashed.error_msg).toBeTruthy();
      });
    });

    // ── isGuest ───────────────────────────────────────────────────────────────

    describe('isGuest', () => {
      test('calls next() when no user in session', () => {
        const req = makeReq({ user: undefined });
        const res = makeRes();
        const next = makeNext();
        middleware.isGuest(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
      });

      test('redirects to / when user is logged in', () => {
        const req = makeReq({ user: { id: 2 } });
        const res = makeRes();
        const next = makeNext();
        middleware.isGuest(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res._redirect).toBe('/');
      });
    });

    // ── isCustomer ────────────────────────────────────────────────────────────

    describe('isCustomer', () => {
      test('calls next() for customer role', () => {
        const req = makeReq({ user: { id: 1, role: 'customer' } });
        const res = makeRes();
        const next = makeNext();
        middleware.isCustomer(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
      });

      test('redirects to / for artisan role', () => {
        const req = makeReq({ user: { id: 2, role: 'artisan' } });
        const res = makeRes();
        const next = makeNext();
        middleware.isCustomer(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res._redirect).toBe('/');
      });

      test('redirects to / for admin role', () => {
        const req = makeReq({ user: { id: 3, role: 'admin' } });
        const res = makeRes();
        const next = makeNext();
        middleware.isCustomer(req, res, next);
        expect(res._redirect).toBe('/');
      });

      test('redirects to / when no user in session', () => {
        const req = makeReq({ user: undefined });
        const res = makeRes();
        const next = makeNext();
        middleware.isCustomer(req, res, next);
        expect(res._redirect).toBe('/');
        expect(next).not.toHaveBeenCalled();
      });

      test('flashes "Access denied" when blocked', () => {
        const flashed = {};
        const req = {
          session: { user: { id: 2, role: 'artisan' } },
          flash: (k, v) => { flashed[k] = v; }
        };
        middleware.isCustomer(req, makeRes(), makeNext());
        expect(flashed.error_msg).toContain('Access denied');
      });
    });

    // ── isCustomerOrGuest ─────────────────────────────────────────────────────

    describe('isCustomerOrGuest', () => {
      test('calls next() when no user (guest)', () => {
        const req = makeReq({ user: undefined });
        const res = makeRes();
        const next = makeNext();
        middleware.isCustomerOrGuest(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
      });

      test('calls next() for customer role', () => {
        const req = makeReq({ user: { id: 1, role: 'customer' } });
        const res = makeRes();
        const next = makeNext();
        middleware.isCustomerOrGuest(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res._redirect).toBeNull();
      });

      test('redirects to / for artisan role (HTML request)', () => {
        const req = makeReq({ user: { id: 2, role: 'artisan' } });
        req.xhr = false;
        const res = makeRes();
        const next = makeNext();
        middleware.isCustomerOrGuest(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res._redirect).toBe('/');
      });

      test('returns 403 JSON for artisan role (XHR request)', () => {
        const req = makeReq({ user: { id: 2, role: 'artisan' } });
        req.xhr = true;
        const res = makeRes();
        const next = makeNext();
        middleware.isCustomerOrGuest(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res._status).toBe(403);
        expect(res._json.success).toBe(false);
        expect(res._json.message).toContain('customers only');
      });

      test('redirects to / for admin role (HTML request)', () => {
        const req = makeReq({ user: { id: 3, role: 'admin' } });
        req.xhr = false;
        const res = makeRes();
        middleware.isCustomerOrGuest(req, res, next_);
        function next_() {}
        expect(res._redirect).toBe('/');
      });

      test('returns 403 JSON for admin role (XHR request)', () => {
        const req = makeReq({ user: { id: 3, role: 'admin' } });
        req.xhr = true;
        const res = makeRes();
        middleware.isCustomerOrGuest(req, res, makeNext());
        expect(res._status).toBe(403);
      });

      test('flashes error for artisan HTML request', () => {
        const flashed = {};
        const req = {
          session: { user: { id: 2, role: 'artisan' } },
          xhr: false,
          flash: (k, v) => { flashed[k] = v; }
        };
        middleware.isCustomerOrGuest(req, makeRes(), makeNext());
        expect(flashed.error_msg).toContain('customers only');
      });
    });

    // ── isArtisan ─────────────────────────────────────────────────────────────

    describe('isArtisan', () => {
      test('calls next() for artisan role', () => {
        const req = makeReq({ user: { id: 1, role: 'artisan' } });
        const res = makeRes();
        const next = makeNext();
        middleware.isArtisan(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
      });

      test('redirects to / for customer role', () => {
        const req = makeReq({ user: { id: 1, role: 'customer' } });
        const res = makeRes();
        middleware.isArtisan(req, res, makeNext());
        expect(res._redirect).toBe('/');
      });

      test('redirects to / for admin role', () => {
        const req = makeReq({ user: { id: 3, role: 'admin' } });
        const res = makeRes();
        middleware.isArtisan(req, res, makeNext());
        expect(res._redirect).toBe('/');
      });

      test('redirects to / when no user', () => {
        const req = makeReq({ user: undefined });
        const res = makeRes();
        middleware.isArtisan(req, res, makeNext());
        expect(res._redirect).toBe('/');
      });

      test('flashes "Artisan account required" when blocked', () => {
        const flashed = {};
        const req = {
          session: { user: { id: 1, role: 'customer' } },
          flash: (k, v) => { flashed[k] = v; }
        };
        middleware.isArtisan(req, makeRes(), makeNext());
        expect(flashed.error_msg).toMatch(/artisan/i);
      });
    });

    // ── isAdmin ───────────────────────────────────────────────────────────────

    describe('isAdmin', () => {
      test('calls next() for admin role', () => {
        const req = makeReq({ user: { id: 1, role: 'admin' } });
        const res = makeRes();
        const next = makeNext();
        middleware.isAdmin(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
      });

      test('redirects to / for customer', () => {
        const req = makeReq({ user: { id: 2, role: 'customer' } });
        const res = makeRes();
        middleware.isAdmin(req, res, makeNext());
        expect(res._redirect).toBe('/');
      });

      test('redirects to / for artisan', () => {
        const req = makeReq({ user: { id: 3, role: 'artisan' } });
        const res = makeRes();
        middleware.isAdmin(req, res, makeNext());
        expect(res._redirect).toBe('/');
      });

      test('redirects to / when no user', () => {
        const req = makeReq({ user: undefined });
        const res = makeRes();
        middleware.isAdmin(req, res, makeNext());
        expect(res._redirect).toBe('/');
      });

      test('flashes "Admin privileges required" when blocked', () => {
        const flashed = {};
        const req = {
          session: { user: { id: 2, role: 'customer' } },
          flash: (k, v) => { flashed[k] = v; }
        };
        middleware.isAdmin(req, makeRes(), makeNext());
        expect(flashed.error_msg).toMatch(/admin/i);
      });
    });

    // ── isApprovedArtisan ─────────────────────────────────────────────────────

    describe('isApprovedArtisan', () => {
      afterEach(() => {
        jest.dontMock('../../models/ArtisanProfile');
      });

      test('calls next() for approved artisan', () => {
        // We need a real DB for ArtisanProfile; mock it inline
        let mw;
        jest.isolateModules(() => {
          jest.doMock('../../models/ArtisanProfile', () => ({
            findByUserId: jest.fn().mockReturnValue({ is_approved: 1 })
          }));
          mw = require('../../middleware/auth');
        });
        const req = makeReq({ user: { id: 99, role: 'artisan' } });
        const res = makeRes();
        const next = makeNext();
        mw.isApprovedArtisan(req, res, next);
        expect(next).toHaveBeenCalled();
      });

      test('redirects to /artisan/pending for unapproved artisan', () => {
        let mw;
        jest.isolateModules(() => {
          jest.doMock('../../models/ArtisanProfile', () => ({
            findByUserId: jest.fn().mockReturnValue({ is_approved: 0 })
          }));
          mw = require('../../middleware/auth');
        });
        const flashed = {};
        const req = {
          session: { user: { id: 98, role: 'artisan' } },
          flash: (k, v) => { flashed[k] = v; }
        };
        const res = makeRes();
        mw.isApprovedArtisan(req, res, makeNext());
        expect(res._redirect).toBe('/artisan/pending');
      });

      test('redirects to /artisan/pending when profile not found', () => {
        let mw;
        jest.isolateModules(() => {
          jest.doMock('../../models/ArtisanProfile', () => ({
            findByUserId: jest.fn().mockReturnValue(null)
          }));
          mw = require('../../middleware/auth');
        });
        const flashed = {};
        const req = {
          session: { user: { id: 97, role: 'artisan' } },
          flash: (k, v) => { flashed[k] = v; }
        };
        const res = makeRes();
        mw.isApprovedArtisan(req, res, makeNext());
        expect(res._redirect).toBe('/artisan/pending');
      });

      test('redirects to / for non-artisan role', () => {
        let mw;
        jest.isolateModules(() => {
          jest.doMock('../../models/ArtisanProfile', () => ({
            findByUserId: jest.fn().mockReturnValue({ is_approved: 1 })
          }));
          mw = require('../../middleware/auth');
        });
        const req = makeReq({ user: { id: 1, role: 'customer' } });
        const res = makeRes();
        mw.isApprovedArtisan(req, res, makeNext());
        expect(res._redirect).toBe('/');
      });

      test('redirects to / when no user', () => {
        let mw;
        jest.isolateModules(() => {
          jest.doMock('../../models/ArtisanProfile', () => ({
            findByUserId: jest.fn().mockReturnValue(null)
          }));
          mw = require('../../middleware/auth');
        });
        const req = makeReq({ user: undefined });
        const res = makeRes();
        mw.isApprovedArtisan(req, res, makeNext());
        expect(res._redirect).toBe('/');
      });

      test('handles DB errors gracefully (redirects to pending)', () => {
        let mw;
        jest.isolateModules(() => {
          jest.doMock('../../models/ArtisanProfile', () => ({
            findByUserId: jest.fn().mockImplementation(() => { throw new Error('DB error'); })
          }));
          mw = require('../../middleware/auth');
        });
        const flashed = {};
        const req = {
          session: { user: { id: 96, role: 'artisan' } },
          flash: (k, v) => { flashed[k] = v; }
        };
        const res = makeRes();
        mw.isApprovedArtisan(req, res, makeNext());
        expect(res._redirect).toBe('/artisan/pending');
      });
    });

    // ── isActive ──────────────────────────────────────────────────────────────

    describe('isActive', () => {
      test('calls next() when user is active', () => {
        const req = makeReq({ user: { id: 1, status: 'active' } });
        const next = makeNext();
        middleware.isActive(req, makeRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
      });

      test('calls next() when no session at all (guest)', () => {
        const req = { session: null };
        const next = makeNext();
        middleware.isActive(req, makeRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
      });

      test('calls next() when session exists but no user', () => {
        const req = { session: {} };
        const next = makeNext();
        middleware.isActive(req, makeRes(), next);
        expect(next).toHaveBeenCalledTimes(1);
      });

      test('redirects suspended user to /auth/login', () => {
        const flashed = {};
        const destroyed = { called: false };
        const req = {
          session: {
            user: { id: 2, status: 'suspended' },
            destroy(cb) { destroyed.called = true; if (cb) cb(); }
          },
          flash: (k, v) => { flashed[k] = v; }
        };
        const res = makeRes();
        middleware.isActive(req, res, makeNext());
        expect(res._redirect).toBe('/auth/login');
        expect(flashed.error_msg).toMatch(/suspended/i);
      });

      test('clears cookie for suspended user when clearCookie available', () => {
        const flashed = {};
        const req = {
          session: {
            user: { id: 2, status: 'suspended' },
            destroy(cb) { if (cb) cb(); }
          },
          flash: (k, v) => { flashed[k] = v; }
        };
        const res = makeRes();
        middleware.isActive(req, res, makeNext());
        expect(res._cookie).toBe('craftify.sid');
      });

      test('handles session.destroy with no callback (length===0)', () => {
        const flashed = {};
        const destroyed = { called: false };
        // A function with no parameters has .length === 0 by default
        function noCallbackDestroy() { destroyed.called = true; }
        const req = {
          session: {
            user: { id: 3, status: 'suspended' },
            destroy: noCallbackDestroy
          },
          flash: (k, v) => { flashed[k] = v; }
        };
        const res = makeRes();
        middleware.isActive(req, res, makeNext());
        expect(destroyed.called).toBe(true);
        expect(res._redirect).toBe('/auth/login');
      });

      test('handles missing session.destroy function gracefully', () => {
        const flashed = {};
        const req = {
          session: {
            user: { id: 4, status: 'suspended' }
            // No destroy function
          },
          flash: (k, v) => { flashed[k] = v; }
        };
        const res = makeRes();
        middleware.isActive(req, res, makeNext());
        expect(res._redirect).toBe('/auth/login');
      });
    });

    // ── attachUser ────────────────────────────────────────────────────────────

    describe('attachUser', () => {
      test('attaches session.user to req.user when present', () => {
        const user = { id: 1, role: 'customer' };
        const req = { session: { user } };
        const next = makeNext();
        middleware.attachUser(req, makeRes(), next);
        expect(req.user).toBe(user);
        expect(next).toHaveBeenCalledTimes(1);
      });

      test('does not set req.user when session has no user', () => {
        const req = { session: {} };
        const next = makeNext();
        middleware.attachUser(req, makeRes(), next);
        expect(req.user).toBeUndefined();
        expect(next).toHaveBeenCalledTimes(1);
      });

      test('calls next() in both cases', () => {
        const req1 = { session: { user: { id: 1 } } };
        const req2 = { session: {} };
        const n1 = makeNext();
        const n2 = makeNext();
        middleware.attachUser(req1, makeRes(), n1);
        middleware.attachUser(req2, makeRes(), n2);
        expect(n1).toHaveBeenCalled();
        expect(n2).toHaveBeenCalled();
      });
    });

    // ── module exports ─────────────────────────────────────────────────────────

    describe('module exports', () => {
      const expectedExports = [
        'isAuthenticated', 'isGuest', 'isCustomer', 'isCustomerOrGuest',
        'isArtisan', 'isAdmin', 'isApprovedArtisan', 'isActive', 'attachUser'
      ];

      expectedExports.forEach(name => {
        test(`exports ${name} as a function`, () => {
          expect(typeof middleware[name]).toBe('function');
        });
      });
    });
  });
};
