module.exports = ({ loadServerHarness }) => {
    test('Production error message and argv jest-mode branches are covered', () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const productionHarness = loadServerHarness({
        nodeEnv: 'production',
        port: 7001,
        sessionSecret: 'prod-secret',
        argv: ['node', 'server.js']
      });

      const csrfProdRes = {
        status: jest.fn(function withStatus(code) {
          this.statusCode = code;
          return this;
        }),
        render: jest.fn()
      };
      productionHarness.errorMiddleware(
        { code: 'EBADCSRFTOKEN', message: 'raw token error' },
        { session: {}, path: '/submit' },
        csrfProdRes,
        jest.fn()
      );
      expect(csrfProdRes.render).toHaveBeenCalledWith(
        'errors/500',
        expect.objectContaining({ error: 'Form submission expired. Please refresh and try again.' })
      );

      const genericProdRes = {
        status: jest.fn(function withStatus(code) {
          this.statusCode = code;
          return this;
        }),
        render: jest.fn()
      };
      productionHarness.errorMiddleware(
        { message: 'raw generic error', stack: 'stack' },
        { session: {}, path: '/server-error' },
        genericProdRes,
        jest.fn()
      );
      expect(genericProdRes.render).toHaveBeenCalledWith(
        'errors/500',
        expect.objectContaining({ error: 'An unexpected error occurred' })
      );

      const jestArgvHarness = loadServerHarness({
        nodeEnv: 'development',
        port: undefined,
        sessionSecret: undefined,
        argv: ['node', 'run-jest-sim']
      });

      expect(jestArgvHarness.csrfFactory).not.toHaveBeenCalled();
      expect(jestArgvHarness.helmetFactory).toHaveBeenCalledWith(
        expect.objectContaining({ contentSecurityPolicy: false })
      );
    });
};
