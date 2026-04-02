module.exports = ({ loadServerHarness, createSocket, createCartDb, createBidDb, createShipmentTaskDb, createAuctionTaskDb }) => {
    test('Development server internals and runtime branches are covered', async () => {
      const intervals = [];
      jest.spyOn(global, 'setInterval').mockImplementation((callback, delay) => {
        intervals.push({ callback, delay });
        return intervals.length;
      });

      jest.spyOn(Math, 'random').mockReturnValue(0.9);
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const harness = loadServerHarness({
        nodeEnv: 'development',
        port: 4567,
        sessionSecret: 'development-secret',
        argv: ['node', 'server.js']
      });

      expect(harness.dotenvConfigMock).toHaveBeenCalled();
      expect(harness.app.settings.io).toBeTruthy();
      expect(harness.app.settings['view engine']).toBe('ejs');
      expect(harness.app.settings['trust proxy']).toBeUndefined();
      expect(harness.helmetFactory).toHaveBeenCalledWith(
        expect.objectContaining({ contentSecurityPolicy: false })
      );

      const next = jest.fn();

      const apiReq = { path: '/api/cart', method: 'GET' };
      harness.csrfGateMiddleware(apiReq, {}, next);
      expect(next).toHaveBeenCalled();

      const nonApiReq = { path: '/orders/checkout' };
      harness.csrfGateMiddleware(nonApiReq, {}, next);
      expect(harness.csrfProtection).toHaveBeenCalled();

      const csrfRes = { locals: {} };
      harness.csrfTokenMiddleware({ csrfToken: () => 'csrf-token' }, csrfRes, next);
      expect(csrfRes.locals.csrfToken).toBe('csrf-token');

      const csrfFallbackRes = { locals: {} };
      harness.csrfTokenMiddleware({}, csrfFallbackRes, next);
      expect(csrfFallbackRes.locals.csrfToken).toBe('');

      const globalsReq = {
        flash: jest.fn((key) => [`value-${key}`]),
        session: { user: { id: 9 } },
        path: '/products'
      };
      const globalsRes = { locals: {} };
      harness.globalLocalsMiddleware(globalsReq, globalsRes, next);
      expect(globalsRes.locals.success_msg).toEqual(['value-success_msg']);
      expect(globalsRes.locals.error_msg).toEqual(['value-error_msg']);
      expect(globalsRes.locals.error).toEqual(['value-error']);
      expect(globalsRes.locals.user).toEqual({ id: 9 });
      expect(globalsRes.locals.currentPath).toBe('/products');

      harness.dbQueue.push(createCartDb({ cartCount: 3, notificationCount: 5 }));
      const userCartReq = { session: { user: { id: 77 } }, sessionID: 'session-1' };
      const userCartRes = { locals: {} };
      await harness.cartCountMiddleware(userCartReq, userCartRes, next);
      expect(userCartRes.locals.cartCount).toBe(3);
      expect(userCartRes.locals.notificationCount).toBe(5);

      harness.dbQueue.push(createCartDb({ cartCount: 2, notificationCount: 0 }));
      const guestCartReq = { session: {}, sessionID: 'guest-abc' };
      const guestCartRes = { locals: {} };
      await harness.cartCountMiddleware(guestCartReq, guestCartRes, next);
      expect(guestCartRes.locals.cartCount).toBe(2);

      harness.dbQueue.push(createCartDb({ cartCount: 0, notificationCount: 0 }));
      const anonymousCartReq = { session: {}, sessionID: null };
      const anonymousCartRes = { locals: {} };
      await harness.cartCountMiddleware(anonymousCartReq, anonymousCartRes, next);
      expect(anonymousCartRes.locals.cartCount || 0).toBe(0);

      harness.dbQueue.push(new Error('cart db unavailable'));
      const cartErrorReq = { session: { user: { id: 10 } }, sessionID: 'err-session' };
      const cartErrorRes = { locals: {} };
      await harness.cartCountMiddleware(cartErrorReq, cartErrorRes, next);
      expect(next).toHaveBeenCalled();

      const socketForSessionMiddleware = { request: {}, data: {} };
      harness.ioState.middlewares[0](socketForSessionMiddleware, next);
      expect(harness.sessionMiddleware).toHaveBeenCalled();

      const authenticatedSocket = { request: { session: { user: { id: 3, name: 'Auth User' } } }, data: {} };
      harness.ioState.middlewares[1](authenticatedSocket, next);
      expect(authenticatedSocket.data.authenticated).toBe(true);

      const unauthenticatedSocket = { request: { session: {} }, data: {} };
      harness.ioState.middlewares[1](unauthenticatedSocket, next);
      expect(unauthenticatedSocket.data.authenticated).toBe(false);

      const socket = createSocket();
      harness.ioState.handlers.connection(socket);

      socket.handlers.joinAuction('55');
      expect(socket.join).toHaveBeenCalledWith('auction-55');

      socket.data.authenticated = false;
      socket.data.user = null;
      await socket.handlers.placeBid({ auctionId: 1, amount: 10 });
      expect(socket.emit).toHaveBeenCalledWith('bidError', { message: 'Please log in to place a bid' });

      socket.data.authenticated = true;
      socket.data.user = { id: 11 };

      harness.dbQueue.push(createBidDb({ auction: { id: 1, status: 'ended', current_highest_bid: 20, starting_price: 10, bid_increment: 5 } }));
      await socket.handlers.placeBid({ auctionId: 1, amount: 30 });
      expect(socket.emit).toHaveBeenCalledWith('bidError', { message: 'Auction is not active' });

      harness.dbQueue.push(createBidDb({ auction: { id: 2, status: 'active', current_highest_bid: 20, starting_price: 10, bid_increment: 5 } }));
      await socket.handlers.placeBid({ auctionId: 2, amount: 22 });
      expect(socket.emit).toHaveBeenCalledWith('bidError', { message: 'Minimum bid is $25.00' });

      harness.dbQueue.push(createBidDb({
        auction: { id: 22, status: 'active', current_highest_bid: null, starting_price: 10, bid_increment: 5 }
      }));
      await socket.handlers.placeBid({ auctionId: 22, amount: 12 });
      expect(socket.emit).toHaveBeenCalledWith('bidError', { message: 'Minimum bid is $15.00' });

      harness.dbQueue.push(createBidDb({
        auction: { id: 3, status: 'active', current_highest_bid: 20, starting_price: 10, bid_increment: 5 },
        bidderName: null,
        bidCount: 9
      }));
      await socket.handlers.placeBid({ auctionId: 3, amount: 30 });
      expect(harness.ioState.roomEmits.some((item) => item.event === 'bidUpdate')).toBe(true);

      harness.dbQueue.push(createBidDb({
        auction: { id: 4, status: 'active', current_highest_bid: 20, starting_price: 10, bid_increment: 5 },
        beginThrows: true
      }));
      await socket.handlers.placeBid({ auctionId: 4, amount: 31 });
      expect(socket.emit).toHaveBeenCalledWith('bidError', { message: 'Failed to place bid' });

      harness.dbQueue.push(createBidDb({
        auction: { id: 5, status: 'active', current_highest_bid: 20, starting_price: 10, bid_increment: 5 },
        failOnInsert: true,
        rollbackThrows: true
      }));
      await socket.handlers.placeBid({ auctionId: 5, amount: 35 });
      expect(socket.emit).toHaveBeenCalledWith('bidError', { message: 'Failed to place bid' });

      socket.handlers.leaveAuction('55');
      expect(socket.leave).toHaveBeenCalledWith('auction-55');

      socket.handlers.disconnect();

      const notFoundRes = {
        status: jest.fn(function withStatus(code) {
          this.statusCode = code;
          return this;
        }),
        render: jest.fn()
      };
      harness.notFoundMiddleware({}, notFoundRes);
      expect(notFoundRes.status).toHaveBeenCalledWith(404);
      expect(notFoundRes.render).toHaveBeenCalledWith('errors/404', { title: 'Page Not Found' });

      const csrfErrorRes = {
        status: jest.fn(function withStatus(code) {
          this.statusCode = code;
          return this;
        }),
        render: jest.fn()
      };
      harness.errorMiddleware(
        { code: 'EBADCSRFTOKEN', message: 'token invalid' },
        { session: { user: { id: 7 } }, path: '/checkout' },
        csrfErrorRes,
        jest.fn()
      );
      expect(csrfErrorRes.status).toHaveBeenCalledWith(403);
      expect(csrfErrorRes.render).toHaveBeenCalledWith(
        'errors/500',
        expect.objectContaining({ error: 'token invalid' })
      );

      const genericErrorRes = {
        status: jest.fn(function withStatus(code) {
          this.statusCode = code;
          return this;
        }),
        render: jest.fn()
      };
      harness.errorMiddleware(
        { message: 'generic error', stack: 'stack' },
        { session: { user: { id: 8 } }, path: '/x' },
        genericErrorRes,
        jest.fn()
      );
      expect(genericErrorRes.status).toHaveBeenCalledWith(500);
      expect(genericErrorRes.render).toHaveBeenCalledWith(
        'errors/500',
        expect.objectContaining({ error: 'generic error' })
      );

      const startedServer = await harness.module.startServer(5010);
      expect(startedServer).toBe(harness.fakeServer);
      expect(harness.initDatabaseMock).toHaveBeenCalled();
      expect(intervals.some((entry) => entry.delay === 60000)).toBe(true);
      expect(intervals.some((entry) => entry.delay === 30000)).toBe(true);

      const shipmentTask = intervals.find((entry) => entry.delay === 60000).callback;
      harness.dbQueue.push(createShipmentTaskDb({
        shipments: [
          { id: 1, order_id: 201, status: 'processing', history: null },
          { id: 2, order_id: 202, status: 'pending', history: '[]' },
          { id: 3, order_id: 203, status: 'delivered', history: '[]' }
        ],
        orderMap: {
          '201': { user_id: 99 },
          '202': null,
          '203': { user_id: 55 }
        }
      }));
      shipmentTask();

      harness.dbQueue.push(new Error('shipment task fail'));
      shipmentTask();

      const auctionTask = intervals.find((entry) => entry.delay === 30000).callback;
      harness.dbQueue.push(createAuctionTaskDb({
        endedAuctions: [
          { id: 301, winner_id: 700, artisan_id: 500, current_highest_bid: 88, product_name: 'Winner Product' },
          { id: 302, winner_id: null, artisan_id: 501, current_highest_bid: 0, product_name: 'No Bid Product' }
        ]
      }));
      auctionTask();

      harness.dbQueue.push(new Error('auction task fail'));
      auctionTask();
      expect(harness.ioState.roomEmits.some((item) => item.event === 'auctionEnded')).toBe(true);

      process.env.NODE_ENV = 'test';
      harness.forceListenError = false;
      await harness.module.startServer();

      harness.forceListenError = true;
      await expect(harness.module.startServer(5011)).rejects.toThrow('listen failed');
    }, 25000);
};
