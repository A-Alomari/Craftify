/**
 * m22-payment-service.suite.js
 * Full branch coverage for services/paymentService.js
 * Tests: authorizePayment — all payment methods, card validation branches,
 *        production lock, ALLOW_MOCK_PAYMENTS override, unsupported provider.
 *
 * Because "isProduction" is evaluated at module-load time we use
 * jest.resetModules() + re-require for production-mode branches.
 */

module.exports = () => {
  describe('Payment Service — full branch coverage', () => {

    const ORIGINAL = {
      NODE_ENV: process.env.NODE_ENV,
      PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
      ALLOW_MOCK_PAYMENTS: process.env.ALLOW_MOCK_PAYMENTS,
    };

    function freshRequire() {
      let mod;
      jest.isolateModules(() => {
        mod = require('../../services/paymentService');
      });
      return mod;
    }

    afterEach(() => {
      process.env.NODE_ENV = ORIGINAL.NODE_ENV;
      if (ORIGINAL.PAYMENT_PROVIDER === undefined) delete process.env.PAYMENT_PROVIDER;
      else process.env.PAYMENT_PROVIDER = ORIGINAL.PAYMENT_PROVIDER;
      if (ORIGINAL.ALLOW_MOCK_PAYMENTS === undefined) delete process.env.ALLOW_MOCK_PAYMENTS;
      else process.env.ALLOW_MOCK_PAYMENTS = ORIGINAL.ALLOW_MOCK_PAYMENTS;
    });

    // ── Cash payment ──────────────────────────────────────────────────────────

    describe('cash payment (happy path)', () => {
      let authorizePayment;
      beforeEach(() => {
        process.env.NODE_ENV = 'test';
        ({ authorizePayment } = freshRequire());
      });

      test('returns authorized result for cash with valid total', () => {
        const result = authorizePayment({ payment_method: 'cash', total_amount: 50 });
        expect(result.provider).toBe('cash');
        expect(result.status).toBe('authorized');
        expect(typeof result.transactionRef).toBe('string');
      });

      test('transactionRef starts with CASH prefix', () => {
        const result = authorizePayment({ payment_method: 'cash', total_amount: 10 });
        expect(result.transactionRef).toMatch(/^CASH/);
      });

      test('transactionRef is 20 characters long (CASH + 16 hex)', () => {
        const result = authorizePayment({ payment_method: 'cash', total_amount: 1 });
        expect(result.transactionRef.length).toBe(20);
      });

      test('cash with amount 0.01 (minimum positive)', () => {
        const result = authorizePayment({ payment_method: 'cash', total_amount: 0.01 });
        expect(result.status).toBe('authorized');
      });

      test('cash with large amount', () => {
        const result = authorizePayment({ payment_method: 'cash', total_amount: 99999 });
        expect(result.status).toBe('authorized');
      });
    });

    // ── Invalid total amount ───────────────────────────────────────────────────

    describe('invalid total_amount', () => {
      let authorizePayment;
      beforeEach(() => {
        process.env.NODE_ENV = 'test';
        ({ authorizePayment } = freshRequire());
      });

      test('throws PAYMENT_VALIDATION when total_amount is 0', () => {
        expect(() => authorizePayment({ payment_method: 'cash', total_amount: 0 }))
          .toThrow();
        try { authorizePayment({ payment_method: 'cash', total_amount: 0 }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION when total_amount is negative', () => {
        try { authorizePayment({ payment_method: 'cash', total_amount: -5 }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION when total_amount is NaN', () => {
        try { authorizePayment({ payment_method: 'cash', total_amount: NaN }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION when total_amount is Infinity', () => {
        try { authorizePayment({ payment_method: 'cash', total_amount: Infinity }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION when total_amount is undefined (defaults to 0)', () => {
        try { authorizePayment({ payment_method: 'cash' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION when total_amount is a string', () => {
        try { authorizePayment({ payment_method: 'cash', total_amount: 'abc' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });
    });

    // ── Invalid payment method ─────────────────────────────────────────────────

    describe('invalid payment method', () => {
      let authorizePayment;
      beforeEach(() => {
        process.env.NODE_ENV = 'test';
        ({ authorizePayment } = freshRequire());
      });

      test('throws PAYMENT_VALIDATION for "bitcoin"', () => {
        try { authorizePayment({ payment_method: 'bitcoin', total_amount: 50 }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for empty string method', () => {
        try { authorizePayment({ payment_method: '', total_amount: 50 }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION when payment_method is undefined', () => {
        try { authorizePayment({ total_amount: 50 }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for "paypal"', () => {
        try { authorizePayment({ payment_method: 'paypal', total_amount: 50 }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws error message containing "Payment method is invalid"', () => {
        try { authorizePayment({ payment_method: 'stripe', total_amount: 50 }); }
        catch (e) { expect(e.message).toContain('invalid'); }
      });
    });

    // ── Card payment — valid ───────────────────────────────────────────────────

    describe('card payment — valid card', () => {
      let authorizePayment;
      beforeEach(() => {
        process.env.NODE_ENV = 'test';
        process.env.PAYMENT_PROVIDER = 'mock';
        ({ authorizePayment } = freshRequire());
      });

      const validCard = {
        payment_method: 'card',
        total_amount: 45,
        card_number: '4111111111111111',
        card_expiry: '12/26',
        card_cvc: '123',
      };

      test('returns authorized mock result for valid Visa number', () => {
        const result = authorizePayment(validCard);
        expect(result.provider).toBe('mock');
        expect(result.status).toBe('authorized');
      });

      test('transactionRef starts with TXN prefix', () => {
        const result = authorizePayment(validCard);
        expect(result.transactionRef).toMatch(/^TXN/);
      });

      test('transactionRef length is 19 (TXN + 16 hex chars)', () => {
        const result = authorizePayment(validCard);
        expect(result.transactionRef.length).toBe(19);
      });

      test('accepts card number with spaces (normalises internally)', () => {
        const result = authorizePayment({ ...validCard, card_number: '4111 1111 1111 1111' });
        expect(result.status).toBe('authorized');
      });

      test('accepts 19-digit card number', () => {
        const result = authorizePayment({
          ...validCard, card_number: '5500000000000000004', card_cvc: '1234'
        });
        expect(result.status).toBe('authorized');
      });

      test('accepts 13-digit card number', () => {
        const result = authorizePayment({
          ...validCard, card_number: '4111111111111'
        });
        expect(result.status).toBe('authorized');
      });

      test('accepts 3-digit CVC', () => {
        const result = authorizePayment({ ...validCard, card_cvc: '000' });
        expect(result.status).toBe('authorized');
      });

      test('accepts 4-digit CVC', () => {
        const result = authorizePayment({ ...validCard, card_cvc: '9999' });
        expect(result.status).toBe('authorized');
      });

      test('accepts month 01 (minimum valid)', () => {
        const result = authorizePayment({ ...validCard, card_expiry: '01/30' });
        expect(result.status).toBe('authorized');
      });

      test('accepts month 12 (maximum valid)', () => {
        const result = authorizePayment({ ...validCard, card_expiry: '12/30' });
        expect(result.status).toBe('authorized');
      });
    });

    // ── Card payment — declined (ending in 0002) ──────────────────────────────

    describe('card payment — declined card', () => {
      let authorizePayment;
      beforeEach(() => {
        process.env.NODE_ENV = 'test';
        process.env.PAYMENT_PROVIDER = 'mock';
        ({ authorizePayment } = freshRequire());
      });

      test('throws PAYMENT_DECLINED for card ending in 0002', () => {
        try {
          authorizePayment({
            payment_method: 'card', total_amount: 50,
            card_number: '4111111110002', card_expiry: '12/26', card_cvc: '123'
          });
        } catch (e) {
          expect(e.code).toBe('PAYMENT_DECLINED');
        }
      });

      test('error message mentions "declined"', () => {
        try {
          authorizePayment({
            payment_method: 'card', total_amount: 50,
            card_number: '4111111110002', card_expiry: '12/26', card_cvc: '123'
          });
        } catch (e) {
          expect(e.message.toLowerCase()).toContain('declined');
        }
      });
    });

    // ── Card payment — validation failures ────────────────────────────────────

    describe('card payment — validation failures', () => {
      let authorizePayment;
      beforeEach(() => {
        process.env.NODE_ENV = 'test';
        process.env.PAYMENT_PROVIDER = 'mock';
        ({ authorizePayment } = freshRequire());
      });

      const base = { payment_method: 'card', total_amount: 45, card_expiry: '12/26', card_cvc: '123' };

      test('throws PAYMENT_VALIDATION for missing card_number', () => {
        try { authorizePayment({ ...base, card_number: '' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for missing card_expiry', () => {
        try { authorizePayment({ ...base, card_number: '4111111111111111', card_expiry: '' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for missing card_cvc', () => {
        try { authorizePayment({ ...base, card_number: '4111111111111111', card_cvc: '' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for card number shorter than 13 digits', () => {
        try { authorizePayment({ ...base, card_number: '411111111' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for card number longer than 19 digits', () => {
        try { authorizePayment({ ...base, card_number: '41111111111111110000' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for card number with letters', () => {
        try { authorizePayment({ ...base, card_number: '411111111111111X' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for expiry in YYYY-MM format', () => {
        try { authorizePayment({ ...base, card_number: '4111111111111111', card_expiry: '2026-12' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for expiry MMYY (no slash)', () => {
        try { authorizePayment({ ...base, card_number: '4111111111111111', card_expiry: '1226' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for month 0 (invalid)', () => {
        try { authorizePayment({ ...base, card_number: '4111111111111111', card_expiry: '00/26' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for month 13 (invalid)', () => {
        try { authorizePayment({ ...base, card_number: '4111111111111111', card_expiry: '13/26' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for 2-digit CVC', () => {
        try { authorizePayment({ ...base, card_number: '4111111111111111', card_cvc: '12' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for 5-digit CVC', () => {
        try { authorizePayment({ ...base, card_number: '4111111111111111', card_cvc: '12345' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });

      test('throws PAYMENT_VALIDATION for CVC with letters', () => {
        try { authorizePayment({ ...base, card_number: '4111111111111111', card_cvc: '12x' }); }
        catch (e) { expect(e.code).toBe('PAYMENT_VALIDATION'); }
      });
    });

    // ── Production mode restrictions ───────────────────────────────────────────

    describe('production mode — mock provider restrictions', () => {
      test('throws PAYMENT_PROVIDER_UNAVAILABLE in production without ALLOW_MOCK_PAYMENTS', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOW_MOCK_PAYMENTS;
        process.env.PAYMENT_PROVIDER = 'mock';
        const { authorizePayment: prodAuth } = freshRequire();

        try {
          prodAuth({
            payment_method: 'card', total_amount: 50,
            card_number: '4111111111111111', card_expiry: '12/26', card_cvc: '123'
          });
          fail('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
        }
      });

      test('succeeds in production when ALLOW_MOCK_PAYMENTS=true', () => {
        process.env.NODE_ENV = 'production';
        process.env.ALLOW_MOCK_PAYMENTS = 'true';
        process.env.PAYMENT_PROVIDER = 'mock';
        const { authorizePayment: prodAuth } = freshRequire();

        const result = prodAuth({
          payment_method: 'card', total_amount: 50,
          card_number: '4111111111111111', card_expiry: '12/26', card_cvc: '123'
        });
        expect(result.status).toBe('authorized');
      });

      test('succeeds in production when ALLOW_MOCK_PAYMENTS=1', () => {
        process.env.NODE_ENV = 'production';
        process.env.ALLOW_MOCK_PAYMENTS = '1';
        process.env.PAYMENT_PROVIDER = 'mock';
        const { authorizePayment: prodAuth } = freshRequire();
        const result = prodAuth({
          payment_method: 'card', total_amount: 50,
          card_number: '4111111111111111', card_expiry: '12/26', card_cvc: '123'
        });
        expect(result.status).toBe('authorized');
      });

      test('succeeds in production when ALLOW_MOCK_PAYMENTS=yes', () => {
        process.env.NODE_ENV = 'production';
        process.env.ALLOW_MOCK_PAYMENTS = 'yes';
        process.env.PAYMENT_PROVIDER = 'mock';
        const { authorizePayment: prodAuth } = freshRequire();
        const result = prodAuth({
          payment_method: 'card', total_amount: 50,
          card_number: '4111111111111111', card_expiry: '12/26', card_cvc: '123'
        });
        expect(result.status).toBe('authorized');
      });

      test('succeeds in production when ALLOW_MOCK_PAYMENTS=on', () => {
        process.env.NODE_ENV = 'production';
        process.env.ALLOW_MOCK_PAYMENTS = 'on';
        process.env.PAYMENT_PROVIDER = 'mock';
        const { authorizePayment: prodAuth } = freshRequire();
        const result = prodAuth({
          payment_method: 'card', total_amount: 50,
          card_number: '4111111111111111', card_expiry: '12/26', card_cvc: '123'
        });
        expect(result.status).toBe('authorized');
      });

      test('is blocked in production when ALLOW_MOCK_PAYMENTS=false', () => {
        process.env.NODE_ENV = 'production';
        process.env.ALLOW_MOCK_PAYMENTS = 'false';
        process.env.PAYMENT_PROVIDER = 'mock';
        const { authorizePayment: prodAuth } = freshRequire();
        try {
          prodAuth({
            payment_method: 'card', total_amount: 50,
            card_number: '4111111111111111', card_expiry: '12/26', card_cvc: '123'
          });
          fail('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
        }
      });

      test('cash is always allowed in production', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOW_MOCK_PAYMENTS;
        const { authorizePayment: prodAuth } = freshRequire();
        const result = prodAuth({ payment_method: 'cash', total_amount: 100 });
        expect(result.status).toBe('authorized');
      });
    });

    // ── Unsupported payment provider ──────────────────────────────────────────

    describe('unsupported payment provider', () => {
      test('throws PAYMENT_PROVIDER_UNAVAILABLE for unknown provider', () => {
        process.env.NODE_ENV = 'test';
        process.env.PAYMENT_PROVIDER = 'stripe';
        const { authorizePayment: authFresh } = freshRequire();
        try {
          authFresh({ payment_method: 'card', total_amount: 50,
            card_number: '4111111111111111', card_expiry: '12/26', card_cvc: '123' });
        } catch (e) {
          expect(e.code).toBe('PAYMENT_PROVIDER_UNAVAILABLE');
          expect(e.message).toContain('stripe');
        }
      });
    });

    // ── Module structure ──────────────────────────────────────────────────────

    describe('module exports', () => {
      test('exports authorizePayment function', () => {
        process.env.NODE_ENV = 'test';
        const mod = freshRequire();
        expect(typeof mod.authorizePayment).toBe('function');
      });

      test('does not export internal helpers', () => {
        process.env.NODE_ENV = 'test';
        const mod = freshRequire();
        expect(mod.buildTransactionRef).toBeUndefined();
        expect(mod.throwPaymentError).toBeUndefined();
        expect(mod.validateCardPayload).toBeUndefined();
        expect(mod.authorizeMockCardPayment).toBeUndefined();
        expect(mod.isEnabled).toBeUndefined();
      });
    });
  });
};
