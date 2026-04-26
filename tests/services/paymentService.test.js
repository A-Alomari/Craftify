/**
 * tests/services/paymentService.test.js
 *
 * Unit tests for services/paymentService.js.
 * No database or HTTP server is required – paymentService is a pure function.
 */

'use strict';

const { authorizePayment } = require('../../services/paymentService');

// ── Helper constants ────────────────────────────────────────────────────────

const VALID_CARD = {
  payment_method: 'card',
  card_number:    '4111111111111111',
  card_expiry:    '12/29',
  card_cvc:       '123',
  total_amount:   50.00,
};

// ── Cash payments ─────────────────────────────────────────────────────────────

describe('authorizePayment – cash method', () => {
  it('returns an authorized result with a CASH-prefixed transaction reference for cash payments', () => {
    const result = authorizePayment({ payment_method: 'cash', total_amount: 30.00 });

    expect(result.status).toBe('authorized');
    expect(result.provider).toBe('cash');
    expect(result.transactionRef).toMatch(/^CASH/);
  });

  it('generates a unique transaction reference for each cash payment', () => {
    const r1 = authorizePayment({ payment_method: 'cash', total_amount: 10.00 });
    const r2 = authorizePayment({ payment_method: 'cash', total_amount: 10.00 });
    expect(r1.transactionRef).not.toBe(r2.transactionRef);
  });
});

// ── Card payments – happy paths ───────────────────────────────────────────────

describe('authorizePayment – card method (mock provider)', () => {
  beforeEach(() => {
    // Ensure mock provider is active and not production-guarded
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_MOCK_PAYMENTS;
  });

  it('returns an authorized result with a TXN-prefixed reference for a valid card', () => {
    const result = authorizePayment(VALID_CARD);

    expect(result.status).toBe('authorized');
    expect(result.provider).toBe('mock');
    expect(result.transactionRef).toMatch(/^TXN/);
  });

  it('accepts a 13-digit card number (minimum valid length)', () => {
    const result = authorizePayment({ ...VALID_CARD, card_number: '4111111111111' });
    expect(result.status).toBe('authorized');
  });

  it('accepts a 19-digit card number (maximum valid length)', () => {
    const result = authorizePayment({ ...VALID_CARD, card_number: '4111111111111111111' });
    expect(result.status).toBe('authorized');
  });

  it('accepts a 4-digit CVC code', () => {
    const result = authorizePayment({ ...VALID_CARD, card_cvc: '1234' });
    expect(result.status).toBe('authorized');
  });

  it('ignores spaces in card number (normalises before validation)', () => {
    const result = authorizePayment({ ...VALID_CARD, card_number: '4111 1111 1111 1111' });
    expect(result.status).toBe('authorized');
  });
});

// ── Card payment – declined simulation ───────────────────────────────────────

describe('authorizePayment – mock-declined card', () => {
  it('throws a PAYMENT_DECLINED error when card number ends in 0002', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, card_number: '4111111100000002' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_DECLINED' }));
  });
});

// ── Card validation errors ────────────────────────────────────────────────────

describe('authorizePayment – card validation errors', () => {
  it('throws PAYMENT_VALIDATION when card_number is missing', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, card_number: '' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when card_number has fewer than 13 digits', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, card_number: '411111' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when card_number has more than 19 digits', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, card_number: '41111111111111111111' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when card_number contains non-digit characters', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, card_number: 'abcdefghijklmno' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when card_expiry is missing', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, card_expiry: '' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when card_expiry uses wrong format (MMYY without slash)', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, card_expiry: '1229' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when card_expiry month is 00', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, card_expiry: '00/29' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when card_expiry month is 13', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, card_expiry: '13/29' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when card_cvc is missing', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, card_cvc: '' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when card_cvc is only 2 digits', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, card_cvc: '12' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when card_cvc is 5 digits', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, card_cvc: '12345' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });
});

// ── Total amount validation ───────────────────────────────────────────────────

describe('authorizePayment – total_amount validation', () => {
  it('throws PAYMENT_VALIDATION when total_amount is zero', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, total_amount: 0 })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when total_amount is negative', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, total_amount: -10 })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when total_amount is NaN', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, total_amount: NaN })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when total_amount is Infinity', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, total_amount: Infinity })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });
});

// ── Payment method validation ─────────────────────────────────────────────────

describe('authorizePayment – payment_method validation', () => {
  it('throws PAYMENT_VALIDATION when payment method is an unknown value', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, payment_method: 'crypto' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });

  it('throws PAYMENT_VALIDATION when payment method is empty string', () => {
    expect(() =>
      authorizePayment({ ...VALID_CARD, payment_method: '' })
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_VALIDATION' }));
  });
});

// ── Production guard ──────────────────────────────────────────────────────────
// NOTE: `isProduction` is evaluated at module load time in paymentService.js.
// We must jest.resetModules() + re-require inside each test to pick up a
// NODE_ENV change; the top-level `authorizePayment` import is not affected.

describe('authorizePayment – production guard', () => {
  afterEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_MOCK_PAYMENTS;
    delete process.env.PAYMENT_PROVIDER;
  });

  it('throws PAYMENT_PROVIDER_UNAVAILABLE when mock provider is used in production without explicit override', () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_PROVIDER = 'mock';
    delete process.env.ALLOW_MOCK_PAYMENTS;

    jest.resetModules();
    const { authorizePayment: authFn } = require('../../services/paymentService');

    expect(() => authFn(VALID_CARD)).toThrow(
      expect.objectContaining({ code: 'PAYMENT_PROVIDER_UNAVAILABLE' })
    );
  });

  it('allows mock payments in production when ALLOW_MOCK_PAYMENTS=true is set', () => {
    process.env.NODE_ENV = 'production';
    process.env.PAYMENT_PROVIDER = 'mock';
    process.env.ALLOW_MOCK_PAYMENTS = 'true';

    jest.resetModules();
    const { authorizePayment: authFn } = require('../../services/paymentService');

    const result = authFn(VALID_CARD);
    expect(result.status).toBe('authorized');
  });

  it('throws PAYMENT_PROVIDER_UNAVAILABLE for an unknown provider name', () => {
    process.env.PAYMENT_PROVIDER = 'stripe_v999';

    expect(() =>
      authorizePayment(VALID_CARD)
    ).toThrow(expect.objectContaining({ code: 'PAYMENT_PROVIDER_UNAVAILABLE' }));
  });
});
