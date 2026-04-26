/**
 * m20-security-policy.suite.js
 * Full branch coverage for utils/securityPolicy.js
 * Tests: parseMinPasswordLength (via getMinPasswordLength), getMinPasswordLength,
 *        getPasswordValidationMessage across all environment combinations.
 */

module.exports = () => {
  describe('Security Policy utilities — full branch coverage', () => {

    // Snapshot env before all tests; restore fully after each.
    const ORIGINAL = {
      NODE_ENV: process.env.NODE_ENV,
      PASSWORD_MIN_LENGTH: process.env.PASSWORD_MIN_LENGTH,
      JEST_WORKER_ID: process.env.JEST_WORKER_ID,
    };

    /** Re-require securityPolicy fresh using isolated module scope. */
    function freshRequire() {
      let mod;
      jest.isolateModules(() => {
        mod = require('../../utils/securityPolicy');
      });
      return mod;
    }

    afterEach(() => {
      // Restore original env
      process.env.NODE_ENV = ORIGINAL.NODE_ENV;
      if (ORIGINAL.PASSWORD_MIN_LENGTH === undefined) {
        delete process.env.PASSWORD_MIN_LENGTH;
      } else {
        process.env.PASSWORD_MIN_LENGTH = ORIGINAL.PASSWORD_MIN_LENGTH;
      }
      if (ORIGINAL.JEST_WORKER_ID === undefined) {
        delete process.env.JEST_WORKER_ID;
      } else {
        process.env.JEST_WORKER_ID = ORIGINAL.JEST_WORKER_ID;
      }
    });

    // ── parseMinPasswordLength (tested via getMinPasswordLength) ─────────────

    describe('parseMinPasswordLength (via getMinPasswordLength)', () => {
      test('returns numeric value when PASSWORD_MIN_LENGTH is a valid integer ≥ 6', () => {
        process.env.PASSWORD_MIN_LENGTH = '8';
        process.env.NODE_ENV = 'test';
        const { getMinPasswordLength } = freshRequire();
        expect(getMinPasswordLength()).toBe(8);
      });

      test('returns numeric value when PASSWORD_MIN_LENGTH is exactly 6', () => {
        process.env.PASSWORD_MIN_LENGTH = '6';
        process.env.NODE_ENV = 'test';
        const { getMinPasswordLength } = freshRequire();
        expect(getMinPasswordLength()).toBe(6);
      });

      test('falls back to default when PASSWORD_MIN_LENGTH is below 6', () => {
        process.env.PASSWORD_MIN_LENGTH = '5';
        process.env.NODE_ENV = 'test';
        const { getMinPasswordLength } = freshRequire();
        expect(getMinPasswordLength()).toBe(6); // test default
      });

      test('falls back to default when PASSWORD_MIN_LENGTH is 0', () => {
        process.env.PASSWORD_MIN_LENGTH = '0';
        process.env.NODE_ENV = 'test';
        const { getMinPasswordLength } = freshRequire();
        expect(getMinPasswordLength()).toBe(6);
      });

      test('falls back to default when PASSWORD_MIN_LENGTH is negative', () => {
        process.env.PASSWORD_MIN_LENGTH = '-1';
        process.env.NODE_ENV = 'test';
        const { getMinPasswordLength } = freshRequire();
        expect(getMinPasswordLength()).toBe(6);
      });

      test('falls back to default when PASSWORD_MIN_LENGTH is not a number', () => {
        process.env.PASSWORD_MIN_LENGTH = 'abc';
        process.env.NODE_ENV = 'test';
        const { getMinPasswordLength } = freshRequire();
        expect(getMinPasswordLength()).toBe(6);
      });

      test('falls back to default when PASSWORD_MIN_LENGTH is empty string', () => {
        process.env.PASSWORD_MIN_LENGTH = '';
        process.env.NODE_ENV = 'test';
        const { getMinPasswordLength } = freshRequire();
        expect(getMinPasswordLength()).toBe(6);
      });

      test('falls back to default when PASSWORD_MIN_LENGTH is undefined', () => {
        delete process.env.PASSWORD_MIN_LENGTH;
        process.env.NODE_ENV = 'test';
        const { getMinPasswordLength } = freshRequire();
        expect(getMinPasswordLength()).toBe(6);
      });

      test('falls back to default when PASSWORD_MIN_LENGTH is a float', () => {
        process.env.PASSWORD_MIN_LENGTH = '8.5';
        process.env.NODE_ENV = 'test';
        const { getMinPasswordLength } = freshRequire();
        // parseInt('8.5') === 8, which is >= 6 → returns 8
        expect(getMinPasswordLength()).toBe(8);
      });
    });

    // ── getMinPasswordLength — environment branches ───────────────────────────

    describe('getMinPasswordLength — environment branches', () => {
      test('returns 6 when NODE_ENV is "test" (jest default)', () => {
        process.env.NODE_ENV = 'test';
        delete process.env.PASSWORD_MIN_LENGTH;
        const { getMinPasswordLength } = freshRequire();
        expect(getMinPasswordLength()).toBe(6);
      });

      test('returns 6 when NODE_ENV is "development"', () => {
        process.env.NODE_ENV = 'development';
        delete process.env.JEST_WORKER_ID;
        delete process.env.PASSWORD_MIN_LENGTH;
        const { getMinPasswordLength } = freshRequire();
        // isJest = argv includes 'jest' → true in test runner, defaultMin=6
        expect(getMinPasswordLength()).toBe(6);
      });

      test('returns user-supplied value larger than 6 in test mode', () => {
        process.env.NODE_ENV = 'test';
        process.env.PASSWORD_MIN_LENGTH = '12';
        const { getMinPasswordLength } = freshRequire();
        expect(getMinPasswordLength()).toBe(12);
      });

      test('returns large values correctly', () => {
        process.env.NODE_ENV = 'test';
        process.env.PASSWORD_MIN_LENGTH = '100';
        const { getMinPasswordLength } = freshRequire();
        expect(getMinPasswordLength()).toBe(100);
      });
    });

    // ── getPasswordValidationMessage ──────────────────────────────────────────

    describe('getPasswordValidationMessage', () => {
      test('includes the minimum length in the message (default 6)', () => {
        process.env.NODE_ENV = 'test';
        delete process.env.PASSWORD_MIN_LENGTH;
        const { getPasswordValidationMessage } = freshRequire();
        const msg = getPasswordValidationMessage();
        expect(msg).toContain('6');
        expect(msg.toLowerCase()).toContain('password');
      });

      test('includes user-supplied minimum length', () => {
        process.env.NODE_ENV = 'test';
        process.env.PASSWORD_MIN_LENGTH = '10';
        const { getPasswordValidationMessage } = freshRequire();
        const msg = getPasswordValidationMessage();
        expect(msg).toContain('10');
      });

      test('message format mentions "at least"', () => {
        process.env.NODE_ENV = 'test';
        delete process.env.PASSWORD_MIN_LENGTH;
        const { getPasswordValidationMessage } = freshRequire();
        expect(getPasswordValidationMessage()).toMatch(/at least/i);
      });

      test('message format mentions "characters"', () => {
        process.env.NODE_ENV = 'test';
        delete process.env.PASSWORD_MIN_LENGTH;
        const { getPasswordValidationMessage } = freshRequire();
        expect(getPasswordValidationMessage()).toMatch(/characters/i);
      });
    });

    // ── Module exports check ──────────────────────────────────────────────────

    describe('module exports', () => {
      test('exports getMinPasswordLength function', () => {
        process.env.NODE_ENV = 'test';
        const mod = freshRequire();
        expect(typeof mod.getMinPasswordLength).toBe('function');
      });

      test('exports getPasswordValidationMessage function', () => {
        process.env.NODE_ENV = 'test';
        const mod = freshRequire();
        expect(typeof mod.getPasswordValidationMessage).toBe('function');
      });

      test('does not export parseMinPasswordLength directly', () => {
        process.env.NODE_ENV = 'test';
        const mod = freshRequire();
        expect(mod.parseMinPasswordLength).toBeUndefined();
      });
    });
  });
};
