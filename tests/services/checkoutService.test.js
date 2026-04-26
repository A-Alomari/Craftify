/**
 * tests/services/checkoutService.test.js
 *
 * Unit tests for services/checkoutService.js.
 * All model dependencies are mocked so each test is isolated and fast.
 *
 * GAP ADDRESSED: Test that verifies the transaction is rolled back when
 * payment is declined (paymentService throws PAYMENT_DECLINED).
 */

'use strict';

// ── Mock all model + service dependencies ───────────────────────────────────
jest.mock('../../models/Cart');
jest.mock('../../models/Order');
jest.mock('../../models/Product');
jest.mock('../../models/Shipment');
jest.mock('../../models/Coupon');
jest.mock('../../models/Notification');
jest.mock('../../models/User');
jest.mock('../../services/paymentService');
jest.mock('../../config/database');

const Cart         = require('../../models/Cart');
const Order        = require('../../models/Order');
const Product      = require('../../models/Product');
const Shipment     = require('../../models/Shipment');
const Coupon       = require('../../models/Coupon');
const Notification = require('../../models/Notification');
const User         = require('../../models/User');
const { authorizePayment } = require('../../services/paymentService');
const database     = require('../../config/database');

const { createOrderFromCheckout } = require('../../services/checkoutService');

// ── Shared mock helpers ──────────────────────────────────────────────────────

function makeMockDb() {
  return {
    exec:        jest.fn(),
    transaction: jest.fn(),
    prepare:     jest.fn(() => ({ run: jest.fn(), get: jest.fn() })),
  };
}

function buildValidInput(overrides = {}) {
  return {
    userId: 2,
    checkoutData: {
      shipping_address:  '1 Test St',
      shipping_building: '',
      shipping_city:     'Manama',
      shipping_postal:   '12345',
      shipping_country:  'Bahrain',
      payment_method:    'card',
      card_number:       '4111111111111111',
      card_expiry:       '12/29',
      card_cvc:          '123',
      notes:             '',
      checkout_nonce:    'nonce-abc-123',
    },
    cartItems: [
      {
        product_id: 10,
        artisan_id: 3,
        quantity:   1,
        price:      45.00,
        name:       'Test Vase',
      },
    ],
    totals: { total: 45.00 },
    appliedCoupon: null,
    ...overrides,
  };
}

// ── Setup defaults for all tests ─────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  const mockDb = makeMockDb();
  database.getDb.mockReturnValue(mockDb);

  Cart.validateItems.mockReturnValue([]);  // no stock issues
  Cart.clear.mockReturnValue(undefined);

  Order.create.mockReturnValue({ id: 99 });
  Order.addItem.mockReturnValue(undefined);
  Order.updateStatus.mockReturnValue(undefined);
  Order.updatePaymentStatus.mockReturnValue(undefined);

  Product.decreaseStock.mockReturnValue({ changes: 1 });

  Shipment.create.mockReturnValue(undefined);

  Coupon.validate.mockReturnValue({ valid: false, discount: 0 });
  Coupon.use.mockReturnValue(undefined);

  Notification.orderPlaced.mockReturnValue(undefined);
  Notification.newOrderForArtisan.mockReturnValue(undefined);

  User.update.mockReturnValue(undefined);

  authorizePayment.mockReturnValue({
    status:       'authorized',
    provider:     'mock',
    transactionRef: 'TXN_MOCK_001',
  });
});

// ── Happy path ────────────────────────────────────────────────────────────────

describe('createOrderFromCheckout – success path', () => {
  it('returns an object with orderId and transactionRef on success', () => {
    const result = createOrderFromCheckout(buildValidInput());

    expect(result).toMatchObject({
      orderId:        99,
      transactionRef: 'TXN_MOCK_001',
    });
  });

  it('calls Order.create with the correct user_id and shipping data', () => {
    createOrderFromCheckout(buildValidInput());

    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id:          2,
        shipping_address: '1 Test St',
        shipping_city:    'Manama',
      })
    );
  });

  it('calls Product.decreaseStock for every cart item', () => {
    const input = buildValidInput({
      cartItems: [
        { product_id: 10, artisan_id: 3, quantity: 2, price: 45.00 },
        { product_id: 11, artisan_id: 3, quantity: 1, price: 20.00 },
      ],
      totals: { total: 110.00 },
    });

    createOrderFromCheckout(input);

    expect(Product.decreaseStock).toHaveBeenCalledWith(10, 2);
    expect(Product.decreaseStock).toHaveBeenCalledWith(11, 1);
  });

  it('calls Cart.clear with the userId after a successful order', () => {
    createOrderFromCheckout(buildValidInput());

    expect(Cart.clear).toHaveBeenCalledWith(2);
  });

  it('adds $5 shipping when the order total is less than $50', () => {
    createOrderFromCheckout(
      buildValidInput({ cartItems: [{ product_id: 10, artisan_id: 3, quantity: 1, price: 20.00 }], totals: { total: 20.00 } })
    );

    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ shipping_cost: 5, total_amount: 25.00 })
    );
  });

  it('adds $0 shipping when the order total is greater than $50', () => {
    createOrderFromCheckout(buildValidInput({ totals: { total: 51.00 } }));

    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ shipping_cost: 0 })
    );
  });

  it('sends an order-placed notification to the customer', () => {
    createOrderFromCheckout(buildValidInput());
    expect(Notification.orderPlaced).toHaveBeenCalledWith(2, 99);
  });

  it('sends a new-order notification to the artisan', () => {
    createOrderFromCheckout(buildValidInput());
    expect(Notification.newOrderForArtisan).toHaveBeenCalledWith(3, 99);
  });

  it('creates a shipment for the new order', () => {
    createOrderFromCheckout(buildValidInput());
    expect(Shipment.create).toHaveBeenCalledWith(99);
  });

  it('marks order as paid and confirmed after payment authorisation', () => {
    createOrderFromCheckout(buildValidInput());

    expect(Order.updatePaymentStatus).toHaveBeenCalledWith(99, 'paid', 'TXN_MOCK_001');
    expect(Order.updateStatus).toHaveBeenCalledWith(99, 'confirmed');
  });
});

// ── Coupon handling ───────────────────────────────────────────────────────────

describe('createOrderFromCheckout – coupon handling', () => {
  it('applies a valid coupon discount to the order total', () => {
    Coupon.validate.mockReturnValue({ valid: true, discount: 10 });

    createOrderFromCheckout(
      buildValidInput({ appliedCoupon: { code: 'TEST10' }, totals: { total: 100.00 } })
    );

    // total 100 + 0 shipping - 10 discount = 90
    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ discount_amount: 10, total_amount: 90 })
    );
  });

  it('calls Coupon.use after a successful order when a coupon was applied', () => {
    Coupon.validate.mockReturnValue({ valid: true, discount: 5 });

    createOrderFromCheckout(
      buildValidInput({ appliedCoupon: { code: 'FLAT5' }, totals: { total: 50.00 } })
    );

    expect(Coupon.use).toHaveBeenCalledWith('FLAT5');
  });

  it('does not call Coupon.use when no coupon is applied', () => {
    createOrderFromCheckout(buildValidInput({ appliedCoupon: null }));
    expect(Coupon.use).not.toHaveBeenCalled();
  });

  it('does not apply a discount when the coupon is present but Coupon.validate returns invalid', () => {
    Coupon.validate.mockReturnValue({ valid: false, discount: 0 });

    createOrderFromCheckout(
      buildValidInput({ appliedCoupon: { code: 'BADCODE' }, totals: { total: 45.00 } })
    );

    expect(Order.create).toHaveBeenCalledWith(
      expect.objectContaining({ discount_amount: 0 })
    );
    expect(Coupon.use).not.toHaveBeenCalled();
  });
});

// ── Own-product rejection ─────────────────────────────────────────────────────

describe('createOrderFromCheckout – own-product rejection', () => {
  it('throws CHECKOUT_VALIDATION when the buyer is the artisan for a cart item', () => {
    const input = buildValidInput({
      userId: 3, // same as artisan_id in cartItem
    });

    expect(() => createOrderFromCheckout(input)).toThrow(
      expect.objectContaining({ code: 'CHECKOUT_VALIDATION' })
    );
  });
});

// ── Out-of-stock detection ────────────────────────────────────────────────────

describe('createOrderFromCheckout – out-of-stock detection', () => {
  it('throws OUT_OF_STOCK when Cart.validateItems reports a stock issue', () => {
    Cart.validateItems.mockReturnValue([{ productId: 10, name: 'Test Vase', requested: 2, available: 1 }]);

    expect(() => createOrderFromCheckout(buildValidInput())).toThrow(
      expect.objectContaining({ code: 'OUT_OF_STOCK' })
    );
  });

  it('throws OUT_OF_STOCK when Product.decreaseStock returns 0 changes', () => {
    Product.decreaseStock.mockReturnValue({ changes: 0 });

    expect(() => createOrderFromCheckout(buildValidInput())).toThrow(
      expect.objectContaining({ code: 'OUT_OF_STOCK' })
    );
  });
});

// ── Invalid total ─────────────────────────────────────────────────────────────

describe('createOrderFromCheckout – invalid total', () => {
  it('throws CHECKOUT_VALIDATION when the computed total is zero or negative', () => {
    // total=-5, shipping=5 → totalAmount = -5+5-0 = 0 ≤ 0 → CHECKOUT_VALIDATION
    const input = buildValidInput({ totals: { total: -5 } });

    expect(() => createOrderFromCheckout(input)).toThrow(
      expect.objectContaining({ code: 'CHECKOUT_VALIDATION' })
    );
  });
});

// ── Payment failure / rollback ────────────────────────────────────────────────
// GAP: Verify transaction is rolled back when payment is declined.

describe('createOrderFromCheckout – payment failure rollback', () => {
  it('throws the original payment error when authorizePayment throws PAYMENT_DECLINED', () => {
    const declined = new Error('Mock payment was declined');
    declined.code  = 'PAYMENT_DECLINED';
    authorizePayment.mockImplementation(() => { throw declined; });

    expect(() => createOrderFromCheckout(buildValidInput())).toThrow(
      expect.objectContaining({ code: 'PAYMENT_DECLINED' })
    );
  });

  it('issues a ROLLBACK command after payment declines', () => {
    const declined = new Error('Declined');
    declined.code  = 'PAYMENT_DECLINED';
    authorizePayment.mockImplementation(() => { throw declined; });

    const mockDb = makeMockDb();
    database.getDb.mockReturnValue(mockDb);

    try { createOrderFromCheckout(buildValidInput()); } catch (_) {}

    // ROLLBACK is sent via db.exec
    const execCalls = mockDb.exec.mock.calls.map(c => c[0]);
    expect(execCalls).toContain('ROLLBACK');
  });

  it('does NOT call Cart.clear when payment fails', () => {
    const declined = new Error('Declined');
    declined.code  = 'PAYMENT_DECLINED';
    authorizePayment.mockImplementation(() => { throw declined; });

    try { createOrderFromCheckout(buildValidInput()); } catch (_) {}

    expect(Cart.clear).not.toHaveBeenCalled();
  });

  it('does NOT call Coupon.use when payment fails even with a valid coupon', () => {
    Coupon.validate.mockReturnValue({ valid: true, discount: 5 });
    const declined = new Error('Declined');
    declined.code  = 'PAYMENT_DECLINED';
    authorizePayment.mockImplementation(() => { throw declined; });

    try {
      createOrderFromCheckout(
        buildValidInput({ appliedCoupon: { code: 'FLAT5' }, totals: { total: 50.00 } })
      );
    } catch (_) {}

    expect(Coupon.use).not.toHaveBeenCalled();
  });
});

// ── Cart item validation ──────────────────────────────────────────────────────

describe('createOrderFromCheckout – cart item field validation', () => {
  it('throws CHECKOUT_VALIDATION when a cart item has an invalid product_id', () => {
    const input = buildValidInput({
      cartItems: [{ product_id: -1, artisan_id: 3, quantity: 1, price: 20.00 }],
    });

    expect(() => createOrderFromCheckout(input)).toThrow(
      expect.objectContaining({ code: 'CHECKOUT_VALIDATION' })
    );
  });

  it('throws CHECKOUT_VALIDATION when a cart item has a zero quantity', () => {
    const input = buildValidInput({
      cartItems: [{ product_id: 10, artisan_id: 3, quantity: 0, price: 20.00 }],
    });

    expect(() => createOrderFromCheckout(input)).toThrow(
      expect.objectContaining({ code: 'CHECKOUT_VALIDATION' })
    );
  });

  it('throws CHECKOUT_VALIDATION when a cart item has a negative price', () => {
    const input = buildValidInput({
      cartItems: [{ product_id: 10, artisan_id: 3, quantity: 1, price: -5.00 }],
    });

    expect(() => createOrderFromCheckout(input)).toThrow(
      expect.objectContaining({ code: 'CHECKOUT_VALIDATION' })
    );
  });
});
