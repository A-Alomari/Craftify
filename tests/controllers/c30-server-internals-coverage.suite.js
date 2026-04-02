module.exports = () => {
  describe('Server Internal Coverage', () => {
    const originalArgv = process.argv.slice();
    const originalNodeEnv = process.env.NODE_ENV;
    const originalPort = process.env.PORT;
    const originalSessionSecret = process.env.SESSION_SECRET;

    const restoreEnvironment = () => {
      process.argv = originalArgv.slice();

      if (typeof originalNodeEnv === 'undefined') {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }

      if (typeof originalPort === 'undefined') {
        delete process.env.PORT;
      } else {
        process.env.PORT = originalPort;
      }

      if (typeof originalSessionSecret === 'undefined') {
        delete process.env.SESSION_SECRET;
      } else {
        process.env.SESSION_SECRET = originalSessionSecret;
      }
    };

    const loadServerHarness = ({
      nodeEnv = 'development',
      port,
      sessionSecret,
      argv = ['node', 'server.js'],
      defaultDb = null
    } = {}) => {
      if (typeof nodeEnv === 'undefined') {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = nodeEnv;
      }

      if (typeof port === 'undefined') {
        delete process.env.PORT;
      } else {
        process.env.PORT = String(port);
      }

      if (typeof sessionSecret === 'undefined') {
        delete process.env.SESSION_SECRET;
      } else {
        process.env.SESSION_SECRET = sessionSecret;
      }

      process.argv = argv.slice();

      const harness = {
        dbQueue: [],
        forceListenError: false
      };

      jest.isolateModules(() => {
        const app = {
          settings: {},
          useCalls: [],
          set: jest.fn((key, value) => {
            app.settings[key] = value;
            return app;
          }),
          use: jest.fn((...args) => {
            app.useCalls.push(args);
            const handler = typeof args[0] === 'function' ? args[0] : args[1];
            if (typeof handler === 'function') {
              const source = handler.toString();
              if (source.includes("req.path.startsWith('/api/')")) harness.csrfGateMiddleware = handler;
              if (source.includes('res.locals.csrfToken')) harness.csrfTokenMiddleware = handler;
              if (source.includes('res.locals.success_msg')) harness.globalLocalsMiddleware = handler;
              if (source.includes('cart_items WHERE user_id')) harness.cartCountMiddleware = handler;
              if (handler.length === 2 && source.includes("errors/404")) harness.notFoundMiddleware = handler;
              if (handler.length === 4 && source.includes('EBADCSRFTOKEN')) harness.errorMiddleware = handler;
            }
            return app;
          })
        };

        const ioState = {
          middlewares: [],
          handlers: {},
          roomEmits: []
        };

        const io = {
          use: jest.fn((middleware) => {
            ioState.middlewares.push(middleware);
            return io;
          }),
          on: jest.fn((event, handler) => {
            ioState.handlers[event] = handler;
            return io;
          }),
          to: jest.fn((room) => ({
            emit: jest.fn((event, payload) => {
              ioState.roomEmits.push({ room, event, payload });
            })
          }))
        };

        const fakeServer = {
          errorHandler: null,
          once: jest.fn((event, handler) => {
            if (event === 'error') {
              fakeServer.errorHandler = handler;
            }
            return fakeServer;
          }),
          listen: jest.fn((listenPort, callback) => {
            harness.listenPort = listenPort;
            if (harness.forceListenError && typeof fakeServer.errorHandler === 'function') {
              fakeServer.errorHandler(new Error('listen failed'));
              return fakeServer;
            }
            if (typeof callback === 'function') {
              callback();
            }
            return fakeServer;
          }),
          removeListener: jest.fn(() => fakeServer)
        };

        const sessionMiddleware = jest.fn((req, res, next) => {
          if (typeof next === 'function') next();
        });
        const sessionFactory = jest.fn(() => sessionMiddleware);

        const flashFactory = jest.fn(() => (req, res, next) => {
          if (typeof next === 'function') next();
        });

        const cookieParserFactory = jest.fn(() => (req, res, next) => {
          if (typeof next === 'function') next();
        });

        const helmetFactory = jest.fn(() => (req, res, next) => {
          if (typeof next === 'function') next();
        });

        const csrfProtection = jest.fn((req, res, next) => {
          if (typeof next === 'function') next();
        });
        const csrfFactory = jest.fn(() => csrfProtection);

        const initDatabaseMock = jest.fn(async () => {});
        const getDbMock = jest.fn(() => {
          if (harness.dbQueue.length > 0) {
            const nextItem = harness.dbQueue.shift();
            if (nextItem instanceof Error) {
              throw nextItem;
            }
            return nextItem;
          }
          return defaultDb || {
            exec: jest.fn(),
            prepare: jest.fn(() => ({
              run: jest.fn(),
              get: jest.fn(() => ({ count: 0 })),
              all: jest.fn(() => [])
            }))
          };
        });

        const dotenvConfigMock = jest.fn();

        const expressMock = jest.fn(() => app);
        expressMock.json = jest.fn(() => (req, res, next) => {
          if (typeof next === 'function') next();
        });
        expressMock.urlencoded = jest.fn(() => (req, res, next) => {
          if (typeof next === 'function') next();
        });
        expressMock.static = jest.fn(() => (req, res, next) => {
          if (typeof next === 'function') next();
        });

        jest.doMock('express', () => expressMock);
        jest.doMock('express-session', () => sessionFactory);
        jest.doMock('connect-flash', () => flashFactory);
        jest.doMock('cookie-parser', () => cookieParserFactory);
        jest.doMock('helmet', () => helmetFactory);
        jest.doMock('csurf', () => csrfFactory);
        jest.doMock('dotenv', () => ({ config: dotenvConfigMock }));
        jest.doMock('http', () => ({ createServer: jest.fn(() => fakeServer) }));
        jest.doMock('socket.io', () => ({ Server: jest.fn(() => io) }));

        jest.doMock('../../config/database', () => ({
          initDatabase: initDatabaseMock,
          getDb: getDbMock
        }));

        jest.doMock('../../routes/auth', () => ({ route: 'auth' }));
        jest.doMock('../../routes/home', () => ({ route: 'home' }));
        jest.doMock('../../routes/products', () => ({ route: 'products' }));
        jest.doMock('../../routes/cart', () => ({ route: 'cart' }));
        jest.doMock('../../routes/orders', () => ({ route: 'orders' }));
        jest.doMock('../../routes/auctions', () => ({ route: 'auctions' }));
        jest.doMock('../../routes/artisan', () => ({ route: 'artisan' }));
        jest.doMock('../../routes/admin', () => ({ route: 'admin' }));
        jest.doMock('../../routes/user', () => ({ route: 'user' }));
        jest.doMock('../../routes/api', () => ({ route: 'api' }));

        harness.module = require('../../server');
        harness.app = app;
        harness.io = io;
        harness.ioState = ioState;
        harness.fakeServer = fakeServer;
        harness.sessionFactory = sessionFactory;
        harness.sessionMiddleware = sessionMiddleware;
        harness.csrfFactory = csrfFactory;
        harness.csrfProtection = csrfProtection;
        harness.initDatabaseMock = initDatabaseMock;
        harness.getDbMock = getDbMock;
        harness.expressMock = expressMock;
        harness.helmetFactory = helmetFactory;
        harness.dotenvConfigMock = dotenvConfigMock;
      });

      return harness;
    };

    const createSocket = () => {
      const socket = {
        request: { session: {} },
        data: {},
        handlers: {},
        join: jest.fn(),
        leave: jest.fn(),
        emit: jest.fn(),
        on: jest.fn((event, handler) => {
          socket.handlers[event] = handler;
        })
      };
      return socket;
    };

    const createCartDb = ({ cartCount = 0, notificationCount = 0 } = {}) => ({
      prepare: jest.fn((sql) => {
        if (sql.includes('SUM(quantity)')) {
          return { get: jest.fn(() => ({ count: cartCount })) };
        }
        if (sql.includes('COUNT(*) as count FROM notifications')) {
          return { get: jest.fn(() => ({ count: notificationCount })) };
        }
        return { get: jest.fn(() => ({ count: 0 })) };
      })
    });

    const createBidDb = ({
      auction = { id: 1, status: 'active', current_highest_bid: 20, starting_price: 10, bid_increment: 5 },
      beginThrows = false,
      failOnInsert = false,
      rollbackThrows = false,
      bidderName = 'Bidder',
      bidCount = 4
    } = {}) => ({
      exec: jest.fn((sql) => {
        if (sql === 'BEGIN TRANSACTION' && beginThrows) {
          throw new Error('begin failure');
        }
        if (sql === 'ROLLBACK' && rollbackThrows) {
          throw new Error('rollback failure');
        }
      }),
      prepare: jest.fn((sql) => {
        if (sql.includes('SELECT * FROM auctions')) {
          return { get: jest.fn(() => auction) };
        }
        if (sql.includes('UPDATE bids SET is_winning = 0')) {
          return { run: jest.fn() };
        }
        if (sql.includes('INSERT INTO bids')) {
          return {
            run: jest.fn(() => {
              if (failOnInsert) {
                throw new Error('insert failure');
              }
            })
          };
        }
        if (sql.includes('UPDATE auctions SET current_highest_bid')) {
          return { run: jest.fn() };
        }
        if (sql.includes('SELECT name FROM users')) {
          return { get: jest.fn(() => ({ name: bidderName })) };
        }
        if (sql.includes('SELECT COUNT(*) as count FROM bids')) {
          return { get: jest.fn(() => ({ count: bidCount })) };
        }
        return {
          run: jest.fn(),
          get: jest.fn(() => null),
          all: jest.fn(() => [])
        };
      })
    });

    const createShipmentTaskDb = ({ shipments, orderMap }) => ({
      prepare: jest.fn((sql) => {
        if (sql.includes('SELECT * FROM shipments')) {
          return { all: jest.fn(() => shipments) };
        }
        if (sql.includes('UPDATE shipments')) {
          return { run: jest.fn() };
        }
        if (sql.includes('UPDATE orders SET status')) {
          return { run: jest.fn() };
        }
        if (sql.includes('SELECT user_id FROM orders WHERE id = ?')) {
          return {
            get: jest.fn((orderId) => {
              const key = String(orderId);
              return Object.prototype.hasOwnProperty.call(orderMap, key) ? orderMap[key] : null;
            })
          };
        }
        if (sql.includes('INSERT INTO notifications')) {
          return { run: jest.fn() };
        }
        return {
          run: jest.fn(),
          get: jest.fn(() => null),
          all: jest.fn(() => [])
        };
      })
    });

    const createAuctionTaskDb = ({ endedAuctions }) => ({
      prepare: jest.fn((sql) => {
        if (sql.includes('SELECT a.*, p.name as product_name')) {
          return { all: jest.fn(() => endedAuctions) };
        }
        return {
          run: jest.fn(),
          get: jest.fn(() => null),
          all: jest.fn(() => [])
        };
      })
    });

    afterEach(() => {
      restoreEnvironment();
      jest.restoreAllMocks();
      jest.clearAllMocks();
      jest.resetModules();

      jest.dontMock('express');
      jest.dontMock('express-session');
      jest.dontMock('connect-flash');
      jest.dontMock('cookie-parser');
      jest.dontMock('helmet');
      jest.dontMock('csurf');
      jest.dontMock('dotenv');
      jest.dontMock('http');
      jest.dontMock('socket.io');

      jest.dontMock('../../config/database');
      jest.dontMock('../../routes/auth');
      jest.dontMock('../../routes/home');
      jest.dontMock('../../routes/products');
      jest.dontMock('../../routes/cart');
      jest.dontMock('../../routes/orders');
      jest.dontMock('../../routes/auctions');
      jest.dontMock('../../routes/artisan');
      jest.dontMock('../../routes/admin');
      jest.dontMock('../../routes/user');
      jest.dontMock('../../routes/api');
    });

    require('./c30-production-startup-guard.suite.js')({ loadServerHarness });
    require('./c30-development-runtime-branches.suite.js')({ loadServerHarness, createSocket, createCartDb, createBidDb, createShipmentTaskDb, createAuctionTaskDb });
    require('./c30-production-jest-branches.suite.js')({ loadServerHarness });
  });
};

