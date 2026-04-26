module.exports = ({ getTestContext, makeUnique }) => {
  let ids;

  const createReqRes = (overrides = {}) => {
    const req = {
      params: {},
      query: {},
      body: {},
      xhr: false,
      file: null,
      files: null,
      sessionID: 'session-test-id',
      session: {
        user: {
          id: 1,
          email: 'user@test.com',
          name: 'Test User',
          role: 'customer',
          status: 'active'
        },
        destroy: jest.fn(),
        appliedCoupon: null
      },
      flash: jest.fn(() => []),
      get: jest.fn(() => '/from-tests'),
      app: {
        get: jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) }))
      }
    };

    const res = {
      statusCode: 200,
      status: jest.fn(function setStatus(code) {
        this.statusCode = code;
        return this;
      }),
      json: jest.fn(function sendJson(payload) {
        this.payload = payload;
        return this;
      }),
      redirect: jest.fn(function doRedirect(url) {
        this.redirectUrl = url;
        return this;
      }),
      render: jest.fn(function doRender(view, model) {
        this.view = view;
        this.model = model;
        return this;
      })
    };

    Object.assign(req, overrides);
    if (overrides.session) {
      req.session = Object.assign(
        {
          user: {
            id: 1,
            email: 'user@test.com',
            name: 'Test User',
            role: 'customer',
            status: 'active'
          },
          destroy: jest.fn(),
          appliedCoupon: null
        },
        overrides.session
      );
    }

    return { req, res };
  };

  beforeAll(() => {
    ({ ids } = getTestContext());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('Direct Controller Coverage', () => {
    require('./c28-direct-admin-coverage.suite.js')({ createReqRes, getIds: () => ids });
    require('./c28-direct-artisan-product-auction-coverage.suite.js')({ createReqRes, getIds: () => ids });
    require('./c28-direct-auth-cart-order-user-home-coverage.suite.js')({ createReqRes, getIds: () => ids, makeUnique });
  });
};

