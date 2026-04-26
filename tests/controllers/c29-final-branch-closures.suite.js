module.exports = ({ getTestContext }) => {
  let ids;

  const createReqRes = (overrides = {}) => {
    const req = {
      params: {},
      query: {},
      body: {},
      xhr: false,
      file: null,
      files: null,
      sessionID: 'session-branch',
      session: {
        user: {
          id: 1,
          email: 'user@test.com',
          name: 'User',
          role: 'customer',
          status: 'active'
        },
        destroy: jest.fn(),
        appliedCoupon: null
      },
      flash: jest.fn(() => []),
      get: jest.fn(() => '/referrer'),
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
            name: 'User',
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
    jest.dontMock('../../models/User');
    jest.dontMock('../../models/ArtisanProfile');
    jest.dontMock('../../models/Cart');
    jest.dontMock('../../models/Notification');
    jest.dontMock('../../config/database');
    jest.dontMock('../../utils/email');
  });

  describe('Final Branch Closures', () => {
    require('./c29-controller-residual-paths.suite.js')({ createReqRes, getIds: () => ids });
    require('./c29-nonserver-single-line-branches.suite.js')({ createReqRes, getIds: () => ids });
    require('./c29-order-user-api-fallbacks.suite.js')({ createReqRes, getIds: () => ids });
    require('./c29-isolated-auth-branch-closures.suite.js')({ createReqRes, getIds: () => ids });
  });
};

