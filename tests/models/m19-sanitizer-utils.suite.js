module.exports = () => {
  const {
    sanitizeString,
    sanitizeText,
    validateRequired,
    validateMaxLength,
    validateCheckoutInput,
    validateMessageInput
  } = require('../../utils/sanitizer');

  describe('Sanitizer utilities — full branch coverage', () => {

    // ── sanitizeString ─────────────────────────────────────────────────────────
    describe('sanitizeString', () => {
      test('trims whitespace from a string', () => {
        expect(sanitizeString('  hello  ')).toBe('hello');
      });

      test('returns non-string values unchanged', () => {
        expect(sanitizeString(42)).toBe(42);
        expect(sanitizeString(null)).toBe(null);
        expect(sanitizeString(undefined)).toBe(undefined);
      });
    });

    // ── sanitizeText ───────────────────────────────────────────────────────────
    describe('sanitizeText', () => {
      test('normalises \\r\\n to \\n and trims', () => {
        expect(sanitizeText('  line1\r\nline2  ')).toBe('line1\nline2');
      });

      test('returns non-string values unchanged', () => {
        expect(sanitizeText(99)).toBe(99);
        expect(sanitizeText(false)).toBe(false);
      });
    });

    // ── validateRequired ───────────────────────────────────────────────────────
    describe('validateRequired', () => {
      test('returns null when value is present', () => {
        expect(validateRequired('hello', 'Field')).toBeNull();
      });

      test('returns error when value is empty string', () => {
        expect(validateRequired('', 'Name')).toContain('Name');
      });

      test('returns error when value is whitespace only', () => {
        expect(validateRequired('   ', 'Email')).toContain('Email');
      });

      test('returns error when value is null', () => {
        expect(validateRequired(null, 'Address')).toContain('Address');
      });

      test('returns error when value is undefined', () => {
        expect(validateRequired(undefined, 'City')).toContain('City');
      });
    });

    // ── validateMaxLength ──────────────────────────────────────────────────────
    describe('validateMaxLength', () => {
      test('returns null when value is within limit', () => {
        expect(validateMaxLength('short', 100, 'Field')).toBeNull();
      });

      test('returns error when value exceeds limit', () => {
        const result = validateMaxLength('x'.repeat(101), 100, 'Bio');
        expect(result).toContain('Bio');
        expect(result).toContain('100');
      });

      test('returns null for non-string values', () => {
        expect(validateMaxLength(42, 10, 'Count')).toBeNull();
        expect(validateMaxLength(null, 10, 'Field')).toBeNull();
      });

      test('returns null when value length equals the limit exactly', () => {
        expect(validateMaxLength('x'.repeat(100), 100, 'Field')).toBeNull();
      });
    });

    // ── validateCheckoutInput ──────────────────────────────────────────────────
    describe('validateCheckoutInput', () => {
      const validCash = {
        shipping_address: '123 Main St',
        shipping_city: 'Manama',
        payment_method: 'cash'
      };

      test('returns no errors for valid cash checkout', () => {
        const { errors, sanitized } = validateCheckoutInput(validCash);
        expect(errors).toHaveLength(0);
        expect(sanitized.shipping_country).toBe('Bahrain');
        expect(sanitized.notes).toBe('');
      });

      test('uses default empty body without throwing', () => {
        const { errors } = validateCheckoutInput();
        expect(errors.length).toBeGreaterThan(0);
      });

      test('returns error when shipping address is missing', () => {
        const { errors } = validateCheckoutInput({ shipping_city: 'Manama', payment_method: 'cash' });
        expect(errors.some(e => e.includes('Shipping address'))).toBe(true);
      });

      test('returns error when shipping city is missing', () => {
        const { errors } = validateCheckoutInput({ shipping_address: '123 St', payment_method: 'cash' });
        expect(errors.some(e => e.includes('Shipping address'))).toBe(true);
      });

      test('returns error when payment method is missing', () => {
        const { errors } = validateCheckoutInput({ shipping_address: '123 St', shipping_city: 'Manama' });
        expect(errors.some(e => e.includes('Payment method'))).toBe(true);
      });

      test('returns error for invalid payment method', () => {
        const { errors } = validateCheckoutInput({ ...validCash, payment_method: 'bitcoin' });
        expect(errors.some(e => e.includes('invalid'))).toBe(true);
      });

      test('returns error when card details are missing for card payment', () => {
        const { errors } = validateCheckoutInput({ ...validCash, payment_method: 'card' });
        expect(errors.some(e => e.includes('Card details are required'))).toBe(true);
      });

      test('returns error for short card number', () => {
        const { errors } = validateCheckoutInput({
          ...validCash, payment_method: 'card',
          card_number: '12345', card_expiry: '12/26', card_cvc: '123'
        });
        expect(errors.some(e => e.includes('13 to 19 digits'))).toBe(true);
      });

      test('returns error for card number with letters', () => {
        const { errors } = validateCheckoutInput({
          ...validCash, payment_method: 'card',
          card_number: '4111111111111abc', card_expiry: '12/26', card_cvc: '123'
        });
        expect(errors.some(e => e.includes('13 to 19 digits'))).toBe(true);
      });

      test('returns error for bad expiry format', () => {
        const { errors } = validateCheckoutInput({
          ...validCash, payment_method: 'card',
          card_number: '4111111111111111', card_expiry: '2026-12', card_cvc: '123'
        });
        expect(errors.some(e => e.includes('MM/YY'))).toBe(true);
      });

      test('returns error for expiry month > 12', () => {
        const { errors } = validateCheckoutInput({
          ...validCash, payment_method: 'card',
          card_number: '4111111111111111', card_expiry: '13/26', card_cvc: '123'
        });
        expect(errors.some(e => e.includes('month is invalid'))).toBe(true);
      });

      test('returns error for expiry month 0', () => {
        const { errors } = validateCheckoutInput({
          ...validCash, payment_method: 'card',
          card_number: '4111111111111111', card_expiry: '00/26', card_cvc: '123'
        });
        expect(errors.some(e => e.includes('month is invalid'))).toBe(true);
      });

      test('returns error for CVC with letters', () => {
        const { errors } = validateCheckoutInput({
          ...validCash, payment_method: 'card',
          card_number: '4111111111111111', card_expiry: '12/26', card_cvc: '12x'
        });
        expect(errors.some(e => e.includes('CVC'))).toBe(true);
      });

      test('returns no errors for a fully valid card checkout', () => {
        const { errors, sanitized } = validateCheckoutInput({
          shipping_address: '99 Pearl Road',
          shipping_city: 'Riffa',
          shipping_country: 'Bahrain',
          shipping_postal: '38000',
          payment_method: 'card',
          card_number: '4 111 111 111 111 111',
          card_expiry: '12/26',
          card_cvc: '123',
          notes: 'Leave at door\r\nplease'
        });
        expect(errors).toHaveLength(0);
        expect(sanitized.card_number).toBe('4111111111111111');
        expect(sanitized.notes).toContain('\n');
        expect(sanitized.shipping_postal).toBe('38000');
      });
    });

    // ── validateMessageInput ───────────────────────────────────────────────────
    describe('validateMessageInput', () => {
      test('returns no errors for valid input', () => {
        const { errors, sanitized } = validateMessageInput({ receiver_id: '5', content: 'Hello!' });
        expect(errors).toHaveLength(0);
        expect(sanitized.receiver_id).toBe(5);
        expect(sanitized.content).toBe('Hello!');
      });

      test('returns error for NaN receiver_id', () => {
        const { errors } = validateMessageInput({ receiver_id: 'abc', content: 'Hi' });
        expect(errors.some(e => e.includes('recipient'))).toBe(true);
      });

      test('returns error for negative receiver_id', () => {
        const { errors } = validateMessageInput({ receiver_id: '-1', content: 'Hi' });
        expect(errors.some(e => e.includes('recipient'))).toBe(true);
      });

      test('returns error for zero receiver_id', () => {
        const { errors } = validateMessageInput({ receiver_id: '0', content: 'Hi' });
        expect(errors.some(e => e.includes('recipient'))).toBe(true);
      });

      test('returns error when content is empty', () => {
        const { errors } = validateMessageInput({ receiver_id: '3', content: '' });
        expect(errors.some(e => e.includes('required'))).toBe(true);
      });

      test('returns error when content is missing', () => {
        const { errors } = validateMessageInput({ receiver_id: '3' });
        expect(errors.some(e => e.includes('required'))).toBe(true);
      });

      test('returns error when content exceeds default max length', () => {
        const { errors } = validateMessageInput({ receiver_id: '3', content: 'x'.repeat(2001) });
        expect(errors.some(e => e.includes('2000'))).toBe(true);
      });

      test('respects custom maxLength parameter', () => {
        const { errors } = validateMessageInput({ receiver_id: '3', content: 'x'.repeat(51) }, 50);
        expect(errors.some(e => e.includes('50'))).toBe(true);
      });

      test('uses default body {} without throwing', () => {
        const { errors } = validateMessageInput();
        expect(errors.length).toBeGreaterThan(0);
      });

      test('normalises \\r\\n in message content', () => {
        const { sanitized } = validateMessageInput({ receiver_id: '5', content: 'line1\r\nline2' });
        expect(sanitized.content).toBe('line1\nline2');
      });
    });
  });
};
