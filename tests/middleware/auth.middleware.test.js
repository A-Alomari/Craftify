/**
 * tests/middleware/auth.middleware.test.js
 *
 * Isolated unit tests for every function exported from middleware/auth.js.
 * No HTTP server is started – middleware is invoked directly with mock
 * req / res / next objects so tests run fast and purely test the logic.
 */

'use strict';

// ── Stub ArtisanProfile before importing the middleware ──────────────────────
jest.mock('../../models/ArtisanProfile', () => ({
  findByUserId: jest.fn(),
}));

const ArtisanProfile = require('../../models/ArtisanProfile');
const {
  isAuthenticated,
  isGuest,
  isCustomer,
  isArtisan,
  isAdmin,
  isApprovedArtisan,
  isActive,
  attachUser,
  isCustomerOrGuest,
} = require('../../middleware/auth');

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildReq(overrides = {}) {
  return {
    session: {},
    flash: jest.fn(),
    xhr: false,
    ...overrides,
  };
}

function buildRes() {
  const res = {
    redirected: null,
    statusCode: null,
    jsonBody: null,
    clearCookie: jest.fn(),
    redirect: jest.fn(function (url) { this.redirected = url; }),
    status:   jest.fn(function (code) { this.statusCode = code; return this; }),
    json:     jest.fn(function (body) { this.jsonBody = body; return this; }),
  };
  return res;
}

// ── isAuthenticated ───────────────────────────────────────────────────────────

describe('isAuthenticated middleware', () => {
  it('calls next() when req.session.user is set', () => {
    const req  = buildReq({ session: { user: { id: 1, role: 'customer' } } });
    const res  = buildRes();
    const next = jest.fn();

    isAuthenticated(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('redirects to /auth/login when no session user exists', () => {
    const req  = buildReq({ session: {} });
    const res  = buildRes();
    const next = jest.fn();

    isAuthenticated(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/auth/login');
  });

  it('sets a flash error message before redirecting', () => {
    const req  = buildReq({ session: {} });
    const res  = buildRes();
    const next = jest.fn();

    isAuthenticated(req, res, next);

    expect(req.flash).toHaveBeenCalledWith('error_msg', expect.any(String));
  });
});

// ── isGuest ───────────────────────────────────────────────────────────────────

describe('isGuest middleware', () => {
  it('calls next() when no session user exists (visitor is a guest)', () => {
    const req  = buildReq({ session: {} });
    const res  = buildRes();
    const next = jest.fn();

    isGuest(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('redirects to / when user is already logged in', () => {
    const req  = buildReq({ session: { user: { id: 1 } } });
    const res  = buildRes();
    const next = jest.fn();

    isGuest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });
});

// ── isCustomer ────────────────────────────────────────────────────────────────

describe('isCustomer middleware', () => {
  it('calls next() when session user has role "customer"', () => {
    const req  = buildReq({ session: { user: { id: 2, role: 'customer' } } });
    const res  = buildRes();
    const next = jest.fn();

    isCustomer(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('redirects to / when session user is an artisan', () => {
    const req  = buildReq({ session: { user: { id: 3, role: 'artisan' } } });
    const res  = buildRes();
    const next = jest.fn();

    isCustomer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('redirects to / when session user is an admin', () => {
    const req  = buildReq({ session: { user: { id: 1, role: 'admin' } } });
    const res  = buildRes();
    const next = jest.fn();

    isCustomer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('redirects to / when there is no session user', () => {
    const req  = buildReq({ session: {} });
    const res  = buildRes();
    const next = jest.fn();

    isCustomer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });
});

// ── isArtisan ─────────────────────────────────────────────────────────────────

describe('isArtisan middleware', () => {
  it('calls next() when session user has role "artisan"', () => {
    const req  = buildReq({ session: { user: { id: 3, role: 'artisan' } } });
    const res  = buildRes();
    const next = jest.fn();

    isArtisan(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('redirects to / when session user is a customer', () => {
    const req  = buildReq({ session: { user: { id: 2, role: 'customer' } } });
    const res  = buildRes();
    const next = jest.fn();

    isArtisan(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('redirects to / when there is no session user', () => {
    const req  = buildReq({ session: {} });
    const res  = buildRes();
    const next = jest.fn();

    isArtisan(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });
});

// ── isAdmin ───────────────────────────────────────────────────────────────────

describe('isAdmin middleware', () => {
  it('calls next() when session user has role "admin"', () => {
    const req  = buildReq({ session: { user: { id: 1, role: 'admin' } } });
    const res  = buildRes();
    const next = jest.fn();

    isAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('redirects to / when session user is a customer', () => {
    const req  = buildReq({ session: { user: { id: 2, role: 'customer' } } });
    const res  = buildRes();
    const next = jest.fn();

    isAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('redirects to / when session user is an artisan', () => {
    const req  = buildReq({ session: { user: { id: 3, role: 'artisan' } } });
    const res  = buildRes();
    const next = jest.fn();

    isAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('redirects to / when there is no session user', () => {
    const req  = buildReq({ session: {} });
    const res  = buildRes();
    const next = jest.fn();

    isAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });
});

// ── isApprovedArtisan ─────────────────────────────────────────────────────────

describe('isApprovedArtisan middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls next() when artisan profile is found and is_approved is truthy', () => {
    ArtisanProfile.findByUserId.mockReturnValue({ id: 1, is_approved: 1 });
    const req  = buildReq({ session: { user: { id: 3, role: 'artisan' } } });
    const res  = buildRes();
    const next = jest.fn();

    isApprovedArtisan(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('redirects to /artisan/pending when artisan profile is not approved', () => {
    ArtisanProfile.findByUserId.mockReturnValue({ id: 1, is_approved: 0 });
    const req  = buildReq({ session: { user: { id: 3, role: 'artisan' } } });
    const res  = buildRes();
    const next = jest.fn();

    isApprovedArtisan(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/artisan/pending');
  });

  it('redirects to /artisan/pending when profile is not found', () => {
    ArtisanProfile.findByUserId.mockReturnValue(null);
    const req  = buildReq({ session: { user: { id: 3, role: 'artisan' } } });
    const res  = buildRes();
    const next = jest.fn();

    isApprovedArtisan(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/artisan/pending');
  });

  it('redirects to / when session user is not an artisan', () => {
    const req  = buildReq({ session: { user: { id: 2, role: 'customer' } } });
    const res  = buildRes();
    const next = jest.fn();

    isApprovedArtisan(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('redirects to /artisan/pending when ArtisanProfile.findByUserId throws', () => {
    ArtisanProfile.findByUserId.mockImplementation(() => { throw new Error('DB error'); });
    const req  = buildReq({ session: { user: { id: 3, role: 'artisan' } } });
    const res  = buildRes();
    const next = jest.fn();

    isApprovedArtisan(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/artisan/pending');
  });
});

// ── isActive ──────────────────────────────────────────────────────────────────

describe('isActive middleware', () => {
  it('calls next() when session user status is "active"', () => {
    const req  = buildReq({ session: { user: { id: 2, status: 'active' } } });
    const res  = buildRes();
    const next = jest.fn();

    isActive(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() when there is no session (visitor)', () => {
    const req  = buildReq({ session: {} });
    const res  = buildRes();
    const next = jest.fn();

    isActive(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('destroys session and redirects to /auth/login when user is suspended', (done) => {
    const req = buildReq({
      session: {
        user: { id: 5, status: 'suspended' },
        destroy: jest.fn((cb) => { cb && cb(); }),
      },
    });
    const res = buildRes();
    const next = jest.fn();

    // isActive calls res.redirect asynchronously via session.destroy callback
    isActive(req, res, next);

    // Allow the microtask/callback to execute
    setImmediate(() => {
      expect(next).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/auth/login');
      done();
    });
  });

  it('sets a flash error message when user is suspended', (done) => {
    const req = buildReq({
      session: {
        user: { id: 5, status: 'suspended' },
        destroy: jest.fn((cb) => { cb && cb(); }),
      },
    });
    const res = buildRes();
    const next = jest.fn();

    isActive(req, res, next);

    setImmediate(() => {
      expect(req.flash).toHaveBeenCalledWith('error_msg', expect.any(String));
      done();
    });
  });

  it('handles session.destroy with zero-arity signature', (done) => {
    // Some session stores expose destroy() with no callback parameter
    const req = buildReq({
      session: {
        user: { id: 5, status: 'suspended' },
        destroy: jest.fn(function () { /* no callback */ }),
      },
    });
    // Make destroy.length === 0
    Object.defineProperty(req.session.destroy, 'length', { value: 0 });
    const res  = buildRes();
    const next = jest.fn();

    isActive(req, res, next);

    setImmediate(() => {
      expect(res.redirect).toHaveBeenCalledWith('/auth/login');
      done();
    });
  });
});

// ── attachUser ────────────────────────────────────────────────────────────────

describe('attachUser middleware', () => {
  it('sets req.user from session when user is logged in', () => {
    const user = { id: 2, role: 'customer' };
    const req  = buildReq({ session: { user } });
    const res  = buildRes();
    const next = jest.fn();

    attachUser(req, res, next);

    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not set req.user when no session user exists', () => {
    const req  = buildReq({ session: {} });
    const res  = buildRes();
    const next = jest.fn();

    attachUser(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

// ── isCustomerOrGuest ─────────────────────────────────────────────────────────

describe('isCustomerOrGuest middleware', () => {
  it('calls next() when there is no session user (guest)', () => {
    const req  = buildReq({ session: {} });
    const res  = buildRes();
    const next = jest.fn();

    isCustomerOrGuest(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('calls next() when session user has role "customer"', () => {
    const req  = buildReq({ session: { user: { id: 2, role: 'customer' } } });
    const res  = buildRes();
    const next = jest.fn();

    isCustomerOrGuest(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('redirects to / when session user is an artisan', () => {
    const req  = buildReq({ session: { user: { id: 3, role: 'artisan' } }, xhr: false });
    const res  = buildRes();
    const next = jest.fn();

    isCustomerOrGuest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });

  it('returns JSON 403 when session user is an artisan and request is XHR', () => {
    const req  = buildReq({ session: { user: { id: 3, role: 'artisan' } }, xhr: true });
    const res  = buildRes();
    const next = jest.fn();

    isCustomerOrGuest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.jsonBody).toMatchObject({ success: false });
  });

  it('redirects to / when session user is an admin', () => {
    const req  = buildReq({ session: { user: { id: 1, role: 'admin' } }, xhr: false });
    const res  = buildRes();
    const next = jest.fn();

    isCustomerOrGuest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/');
  });
});
