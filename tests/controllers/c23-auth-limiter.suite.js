const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Auth Route Limiter Initialization Coverage', () => {
    const originalArgv = process.argv.slice();
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      jest.clearAllMocks();
      jest.dontMock('express');
      jest.dontMock('express-rate-limit');
      jest.dontMock('multer');
      jest.dontMock('../../controllers/authController');
      jest.dontMock('../../middleware/auth');
      process.argv = originalArgv.slice();
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('Auth route treats argv with jest token as test mode when NODE_ENV is not test', () => {
      process.env.NODE_ENV = 'development';
      process.argv = ['node', 'script.js', 'run-jest-like'];

      jest.isolateModules(() => {
        const passthrough = jest.fn((req, res, next) => next && next());
        const fakeRouter = { get: jest.fn(), post: jest.fn() };

        const multerMock = jest.fn(() => ({ single: jest.fn(() => passthrough) }));
        multerMock.diskStorage = jest.fn(() => ({}));

        const rateLimitFactory = jest.fn(() => jest.fn());

        jest.doMock('express', () => ({ Router: () => fakeRouter }));
        jest.doMock('express-rate-limit', () => rateLimitFactory);
        jest.doMock('multer', () => multerMock);
        jest.doMock('../../controllers/authController', () => ({
          showLogin: jest.fn(),
          login: jest.fn(),
          showRegister: jest.fn(),
          register: jest.fn(),
          showArtisanRegister: jest.fn(),
          registerArtisan: jest.fn(),
          logout: jest.fn(),
          showForgotPassword: jest.fn(),
          forgotPassword: jest.fn(),
          showResetPassword: jest.fn(),
          resetPassword: jest.fn()
        }));
        jest.doMock('../../middleware/auth', () => ({ isGuest: passthrough }));

        require('../../routes/auth');

        expect(rateLimitFactory).not.toHaveBeenCalled();

        const loginPost = fakeRouter.post.mock.calls.find((call) => call[0] === '/login');
        const registerPost = fakeRouter.post.mock.calls.find((call) => call[0] === '/register');

        expect(loginPost).toBeTruthy();
        expect(registerPost).toBeTruthy();
        expect(typeof loginPost[1]).toBe('function');
        expect(typeof registerPost[1]).toBe('function');
      });
    });

    test('Auth route uses express-rate-limit middleware when not in test mode', () => {
      process.env.NODE_ENV = 'development';
      process.argv = ['node', 'server.js'];

      jest.isolateModules(() => {
        const passthrough = jest.fn((req, res, next) => next && next());
        const fakeRouter = { get: jest.fn(), post: jest.fn() };

        const multerMock = jest.fn(() => ({ single: jest.fn(() => passthrough) }));
        multerMock.diskStorage = jest.fn(() => ({}));

        const loginLimiter = jest.fn();
        const registerLimiter = jest.fn();
        const forgotLimiter = jest.fn();
        const resetLimiter = jest.fn();
        const rateLimitFactory = jest
          .fn()
          .mockImplementationOnce(() => loginLimiter)
          .mockImplementationOnce(() => registerLimiter)
          .mockImplementationOnce(() => forgotLimiter)
          .mockImplementationOnce(() => resetLimiter);

        jest.doMock('express', () => ({ Router: () => fakeRouter }));
        jest.doMock('express-rate-limit', () => rateLimitFactory);
        jest.doMock('multer', () => multerMock);
        jest.doMock('../../controllers/authController', () => ({
          showLogin: jest.fn(),
          login: jest.fn(),
          showRegister: jest.fn(),
          register: jest.fn(),
          showArtisanRegister: jest.fn(),
          registerArtisan: jest.fn(),
          logout: jest.fn(),
          showForgotPassword: jest.fn(),
          forgotPassword: jest.fn(),
          showResetPassword: jest.fn(),
          resetPassword: jest.fn()
        }));
        jest.doMock('../../middleware/auth', () => ({ isGuest: passthrough }));

        require('../../routes/auth');

        expect(rateLimitFactory).toHaveBeenCalledTimes(4);

        const loginPost = fakeRouter.post.mock.calls.find((call) => call[0] === '/login');
        const registerPost = fakeRouter.post.mock.calls.find((call) => call[0] === '/register');

        expect(loginPost).toBeTruthy();
        expect(registerPost).toBeTruthy();
        expect(loginPost[1]).toBe(loginLimiter);
        expect(registerPost[1]).toBe(registerLimiter);
      });
    });
  });
};

