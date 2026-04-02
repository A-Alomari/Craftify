module.exports = ({ loadServerHarness }) => {
    test('Production startup guard exits when session secret is missing', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process exit');
      });

      expect(() => loadServerHarness({
        nodeEnv: 'production',
        sessionSecret: undefined,
        argv: ['node', 'server.js']
      })).toThrow('process exit');

      expect(errorSpy).toHaveBeenCalledWith('FATAL: SESSION_SECRET environment variable is required in production');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
};
