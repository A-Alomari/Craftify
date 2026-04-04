const { v4: uuidv4 } = require('uuid');

const isProduction = process.env.NODE_ENV === 'production';

function isEnabled(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').toLowerCase());
}

function buildTransactionRef(prefix = 'PAY') {
  return `${prefix}${uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase()}`;
}

function throwPaymentError(message, code = 'PAYMENT_ERROR') {
  const err = new Error(message);
  err.code = code;
  throw err;
}

function validateCardPayload({ card_number, card_expiry, card_cvc }) {
  const normalizedNumber = String(card_number || '').replace(/\s+/g, '');
  const normalizedExpiry = String(card_expiry || '').trim();
  const normalizedCvc = String(card_cvc || '').trim();

  if (!normalizedNumber || !normalizedExpiry || !normalizedCvc) {
    throwPaymentError('Card details are required for card payments', 'PAYMENT_VALIDATION');
  }

  if (!/^\d{13,19}$/.test(normalizedNumber)) {
    throwPaymentError('Card number must contain 13 to 19 digits', 'PAYMENT_VALIDATION');
  }

  const expiryMatch = normalizedExpiry.match(/^(\d{2})\/(\d{2})$/);
  if (!expiryMatch) {
    throwPaymentError('Card expiry must use MM/YY format', 'PAYMENT_VALIDATION');
  }

  const month = Number.parseInt(expiryMatch[1], 10);
  if (Number.isNaN(month) || month < 1 || month > 12) {
    throwPaymentError('Card expiry month is invalid', 'PAYMENT_VALIDATION');
  }

  if (!/^\d{3,4}$/.test(normalizedCvc)) {
    throwPaymentError('Card CVC is invalid', 'PAYMENT_VALIDATION');
  }

  return {
    card_number: normalizedNumber,
    card_expiry: normalizedExpiry,
    card_cvc: normalizedCvc
  };
}

function authorizeMockCardPayment(payload) {
  const card = validateCardPayload(payload);

  if (card.card_number.endsWith('0002')) {
    throwPaymentError('Mock payment was declined. Please try a different test card.', 'PAYMENT_DECLINED');
  }

  return {
    provider: 'mock',
    status: 'authorized',
    transactionRef: buildTransactionRef('TXN')
  };
}

function authorizePayment(payload = {}) {
  const paymentMethod = String(payload.payment_method || '').trim().toLowerCase();
  const totalAmount = Number(payload.total_amount || 0);
  const paymentProvider = String(process.env.PAYMENT_PROVIDER || 'mock').trim().toLowerCase();

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throwPaymentError('Order total is invalid', 'PAYMENT_VALIDATION');
  }

  if (paymentMethod === 'cash') {
    return {
      provider: 'cash',
      status: 'authorized',
      transactionRef: buildTransactionRef('CASH')
    };
  }

  if (paymentMethod !== 'card') {
    throwPaymentError('Payment method is invalid', 'PAYMENT_VALIDATION');
  }

  if (paymentProvider === 'mock') {
    if (isProduction && !isEnabled(process.env.ALLOW_MOCK_PAYMENTS)) {
      throwPaymentError(
        'Mock payment provider is disabled in production. Configure a real provider or enable ALLOW_MOCK_PAYMENTS explicitly.',
        'PAYMENT_PROVIDER_UNAVAILABLE'
      );
    }

    return authorizeMockCardPayment(payload);
  }

  throwPaymentError(`Unsupported payment provider: ${paymentProvider}`, 'PAYMENT_PROVIDER_UNAVAILABLE');
}

module.exports = {
  authorizePayment
};
