/**
 * m24-checkout-service.suite.js
 * Full branch coverage for services/checkoutService.js
 * Tests: runTransactionCommand (all 3 branches) and createOrderFromCheckout
 * (own-product check, coupon paths, total validation, stock re-check,
 *  item validation, payment, notifications, rollback on error).
 *
 * Uses jest.doMock() (non-hoisted) so dependency mocks can reference
 * closure variables built per-test.
 */

module.exports = () => {
  describe('Checkout Service — full branch coverage', () => {

    // ── runTransactionCommand ──────────────────────────────────────────────────

    describe('runTransactionCommand', () => {
      let runTransactionCommand;

      beforeAll(() => {
        ({ runTransactionCommand } = require('../../services/checkoutService'));
      });

      test('calls db.exec when it is a function', () => {
        const db = { exec: jest.fn() };
        runTransactionCommand(db, 'BEGIN TRANSACTION');
        expect(db.exec).toHaveBeenCalledWith('BEGIN TRANSACTION');
      });

      test('does not call db.transaction when db.exec exists', () => {
        const db = { exec: jest.fn(), transaction: jest.fn() };
        runTransactionCommand(db, 'COMMIT');
        expect(db.exec).toHaveBeenCalledTimes(1);
        expect(db.transaction).not.toHaveBeenCalled();
      });

      test('calls db.transaction when db.exec is not a function', () => {
        const db = { transaction: jest.fn() };
        runTransactionCommand(db, 'ROLLBACK');
        expect(db.transaction).toHaveBeenCalledWith('ROLLBACK');
      });

      test('throws when neither db.exec nor db.transaction is available', () => {
        const db = {};
        expect(() => runTransactionCommand(db, 'BEGIN')).toThrow('Database transaction command is not supported');
      });

      test('throws when db.exec is null (not a function)', () => {
        const db = { exec: null };
        expect(() => runTransactionCommand(db, 'BEGIN')).toThrow();
      });

      test('returns undefined on success (exec path)', () => {
        const db = { exec: jest.fn() };
        const result = runTransactionCommand(db, 'COMMIT');
        expect(result).toBeUndefined();
      });

      test('returns undefined on success (transaction path)', () => {
        const db = { transaction: jest.fn() };
        const result = runTransactionCommand(db, 'COMMIT');
        expect(result).toBeUndefined();
      });
    });

    // ── createOrderFromCheckout ────────────────────────────────────────────────

    describe('createOrderFromCheckout', () => {
      const mockOrder = { id: 42 };

      /**
       * Build fresh mocks + re-require checkoutService with jest.doMock
       * so the dependency factories can reference the mock objects.
       */
      function setupMocks(overrides = {}) {
        // Build per-call mocks (fresh fn instances so calls don't bleed between tests)
        const mockExec = jest.fn();
        const mockDb = { exec: mockExec };

        const mockCartValidateItems = overrides.cartValidateItems || jest.fn().mockReturnValue([]);
        const mockCartClear = overrides.cartClear || jest.fn();
        const mockOrderCreate = overrides.orderCreate || jest.fn().mockReturnValue(mockOrder);
        const mockOrderAddItem = overrides.orderAddItem || jest.fn();
        const mockOrderUpdatePaymentStatus = overrides.orderUpdatePaymentStatus || jest.fn();
        const mockOrderUpdateStatus = overrides.orderUpdateStatus || jest.fn();
        const mockProductDecreaseStock = overrides.productDecreaseStock || jest.fn().mockReturnValue({ changes: 1 });
        const mockShipmentCreate = overrides.shipmentCreate || jest.fn();
        const mockCouponValidate = overrides.couponValidate || jest.fn().mockReturnValue({ valid: false, discount: 0 });
        const mockCouponUse = overrides.couponUse || jest.fn();
        const mockNotificationOrderPlaced = overrides.notificationOrderPlaced || jest.fn();
        const mockNotificationNewOrderForArtisan = overrides.notificationNewOrderForArtisan || jest.fn();
        const mockAuthorizePayment = overrides.authorizePayment || jest.fn().mockReturnValue({ provider: 'cash', status: 'authorized', transactionRef: 'CASH1234567890123456' });
        const mockGetDb = overrides.getDb || jest.fn().mockReturnValue(mockDb);

        let createOrderFromCheckout;
        jest.isolateModules(() => {
          jest.doMock('../../config/database', () => ({ getDb: mockGetDb }));
          jest.doMock('../../models/Cart', () => ({
            validateItems: mockCartValidateItems,
            clear: mockCartClear,
          }));
          jest.doMock('../../models/Order', () => ({
            create: mockOrderCreate,
            addItem: mockOrderAddItem,
            updatePaymentStatus: mockOrderUpdatePaymentStatus,
            updateStatus: mockOrderUpdateStatus,
          }));
          jest.doMock('../../models/Product', () => ({
            decreaseStock: mockProductDecreaseStock,
          }));
          jest.doMock('../../models/Shipment', () => ({
            create: mockShipmentCreate,
          }));
          jest.doMock('../../models/Coupon', () => ({
            validate: mockCouponValidate,
            use: mockCouponUse,
          }));
          jest.doMock('../../models/Notification', () => ({
            orderPlaced: mockNotificationOrderPlaced,
            newOrderForArtisan: mockNotificationNewOrderForArtisan,
          }));
          jest.doMock('../../services/paymentService', () => ({
            authorizePayment: mockAuthorizePayment,
          }));

          ({ createOrderFromCheckout } = require('../../services/checkoutService'));
        });

        return {
          createOrderFromCheckout,
          mockDb,
          mockExec,
          mockCartValidateItems,
          mockCartClear,
          mockOrderCreate,
          mockOrderAddItem,
          mockOrderUpdatePaymentStatus,
          mockOrderUpdateStatus,
          mockProductDecreaseStock,
          mockShipmentCreate,
          mockCouponValidate,
          mockCouponUse,
          mockNotificationOrderPlaced,
          mockNotificationNewOrderForArtisan,
          mockAuthorizePayment,
          mockGetDb,
        };
      }

      afterEach(() => {
        jest.restoreAllMocks();
        jest.dontMock('../../config/database');
        jest.dontMock('../../models/Cart');
        jest.dontMock('../../models/Order');
        jest.dontMock('../../models/Product');
        jest.dontMock('../../models/Shipment');
        jest.dontMock('../../models/Coupon');
        jest.dontMock('../../models/Notification');
        jest.dontMock('../../services/paymentService');
      });

      // Helper — minimal valid input
      function makeInput(overrides = {}) {
        return {
          userId: 1,
          checkoutData: {
            shipping_address: '123 Main St',
            shipping_city: 'Manama',
            shipping_postal: '12345',
            shipping_country: 'Bahrain',
            payment_method: 'cash',
            notes: '',
          },
          cartItems: [
            { product_id: 10, artisan_id: 5, quantity: 1, price: 20 },
          ],
          totals: { total: 60 },
          appliedCoupon: null,
          ...overrides,
        };
      }

      // ── Own-product guard ─────────────────────────────────────────────────

      test('throws CHECKOUT_VALIDATION when user owns a cart item', () => {
        const { createOrderFromCheckout } = setupMocks();
        const input = makeInput({
          userId: 5,
          cartItems: [{ product_id: 10, artisan_id: 5, quantity: 1, price: 20 }],
        });
        try {
          createOrderFromCheckout(input);
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('CHECKOUT_VALIDATION');
          expect(e.message).toMatch(/own product/i);
        }
      });

      test('does not throw when user does NOT own any cart item', () => {
        const { createOrderFromCheckout } = setupMocks();
        expect(() => createOrderFromCheckout(makeInput({ userId: 99 }))).not.toThrow();
      });

      // ── Shipping cost calculation ─────────────────────────────────────────

      test('shipping is 0 when subtotal > 50', () => {
        const { createOrderFromCheckout, mockOrderCreate } = setupMocks();
        createOrderFromCheckout(makeInput({ totals: { total: 60 } }));
        expect(mockOrderCreate.mock.calls[0][0].shipping_cost).toBe(0);
      });

      test('shipping is 5 when subtotal === 50 (not strictly > 50)', () => {
        const { createOrderFromCheckout, mockOrderCreate } = setupMocks();
        createOrderFromCheckout(makeInput({ totals: { total: 50 } }));
        expect(mockOrderCreate.mock.calls[0][0].shipping_cost).toBe(5);
      });

      test('shipping is 5 when subtotal < 50', () => {
        const { createOrderFromCheckout, mockOrderCreate } = setupMocks();
        const input = makeInput({
          totals: { total: 30 },
          cartItems: [{ product_id: 10, artisan_id: 5, quantity: 1, price: 30 }],
        });
        createOrderFromCheckout(input);
        expect(mockOrderCreate.mock.calls[0][0].shipping_cost).toBe(5);
      });

      // ── Coupon paths ──────────────────────────────────────────────────────

      test('applies coupon discount when coupon validates successfully', () => {
        const { createOrderFromCheckout, mockOrderCreate } = setupMocks({
          couponValidate: jest.fn().mockReturnValue({ valid: true, discount: 10 }),
        });
        createOrderFromCheckout(makeInput({ appliedCoupon: { code: 'SAVE10' } }));
        const arg = mockOrderCreate.mock.calls[0][0];
        expect(arg.discount_amount).toBe(10);
        expect(arg.coupon_code).toBe('SAVE10');
      });

      test('does not apply discount when coupon.valid is false', () => {
        const { createOrderFromCheckout, mockOrderCreate } = setupMocks({
          couponValidate: jest.fn().mockReturnValue({ valid: false, discount: 0 }),
        });
        createOrderFromCheckout(makeInput({ appliedCoupon: { code: 'INVALID' } }));
        const arg = mockOrderCreate.mock.calls[0][0];
        expect(arg.discount_amount).toBe(0);
        expect(arg.coupon_code).toBeNull();
      });

      test('skips coupon validation entirely when appliedCoupon is null', () => {
        const { createOrderFromCheckout, mockCouponValidate } = setupMocks();
        createOrderFromCheckout(makeInput({ appliedCoupon: null }));
        expect(mockCouponValidate).not.toHaveBeenCalled();
      });

      test('calls Coupon.use when a coupon is applied', () => {
        const { createOrderFromCheckout, mockCouponUse } = setupMocks({
          couponValidate: jest.fn().mockReturnValue({ valid: true, discount: 5 }),
        });
        createOrderFromCheckout(makeInput({ appliedCoupon: { code: 'HALF' } }));
        expect(mockCouponUse).toHaveBeenCalledWith('HALF');
      });

      test('does NOT call Coupon.use when coupon is invalid', () => {
        const { createOrderFromCheckout, mockCouponUse } = setupMocks({
          couponValidate: jest.fn().mockReturnValue({ valid: false, discount: 0 }),
        });
        createOrderFromCheckout(makeInput({ appliedCoupon: { code: 'BAD' } }));
        expect(mockCouponUse).not.toHaveBeenCalled();
      });

      // ── Total amount validation ───────────────────────────────────────────

      test('throws CHECKOUT_VALIDATION when computed total is 0', () => {
        const { createOrderFromCheckout } = setupMocks({
          couponValidate: jest.fn().mockReturnValue({ valid: true, discount: 35 }), // 30+5-35=0
        });
        const input = makeInput({
          totals: { total: 30 },
          appliedCoupon: { code: 'ALL' },
          cartItems: [{ product_id: 10, artisan_id: 5, quantity: 1, price: 30 }],
        });
        try {
          createOrderFromCheckout(input);
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('CHECKOUT_VALIDATION');
        }
      });

      test('throws CHECKOUT_VALIDATION when total becomes negative', () => {
        const { createOrderFromCheckout } = setupMocks({
          couponValidate: jest.fn().mockReturnValue({ valid: true, discount: 500 }),
        });
        try {
          createOrderFromCheckout(makeInput({ appliedCoupon: { code: 'MEGA' } }));
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('CHECKOUT_VALIDATION');
        }
      });

      test('throws CHECKOUT_VALIDATION when subtotal is NaN', () => {
        const { createOrderFromCheckout } = setupMocks();
        try {
          createOrderFromCheckout(makeInput({ totals: { total: NaN } }));
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('CHECKOUT_VALIDATION');
        }
      });

      // ── Stock re-check ─────────────────────────────────────────────────────

      test('throws OUT_OF_STOCK when Cart.validateItems returns issues', () => {
        const { createOrderFromCheckout } = setupMocks({
          cartValidateItems: jest.fn().mockReturnValue([{ product_id: 10, issue: 'out of stock' }]),
        });
        try {
          createOrderFromCheckout(makeInput());
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('OUT_OF_STOCK');
        }
      });

      test('proceeds when Cart.validateItems returns empty array', () => {
        const { createOrderFromCheckout } = setupMocks({
          cartValidateItems: jest.fn().mockReturnValue([]),
        });
        expect(() => createOrderFromCheckout(makeInput())).not.toThrow();
      });

      // ── Item-level validation ─────────────────────────────────────────────

      test('throws CHECKOUT_VALIDATION for invalid product_id (0)', () => {
        const { createOrderFromCheckout } = setupMocks();
        try {
          createOrderFromCheckout(makeInput({
            cartItems: [{ product_id: 0, artisan_id: 5, quantity: 1, price: 20 }],
          }));
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('CHECKOUT_VALIDATION');
          expect(e.message).toMatch(/invalid item/i);
        }
      });

      test('throws CHECKOUT_VALIDATION for negative product_id', () => {
        const { createOrderFromCheckout } = setupMocks();
        try {
          createOrderFromCheckout(makeInput({
            cartItems: [{ product_id: -1, artisan_id: 5, quantity: 1, price: 20 }],
          }));
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('CHECKOUT_VALIDATION');
        }
      });

      test('throws CHECKOUT_VALIDATION for product_id NaN after parseInt', () => {
        const { createOrderFromCheckout } = setupMocks();
        try {
          createOrderFromCheckout(makeInput({
            cartItems: [{ product_id: 'abc', artisan_id: 5, quantity: 1, price: 20 }],
          }));
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('CHECKOUT_VALIDATION');
        }
      });

      test('throws CHECKOUT_VALIDATION for quantity 0', () => {
        const { createOrderFromCheckout } = setupMocks();
        try {
          createOrderFromCheckout(makeInput({
            cartItems: [{ product_id: 10, artisan_id: 5, quantity: 0, price: 20 }],
          }));
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('CHECKOUT_VALIDATION');
          expect(e.message).toMatch(/quantity/i);
        }
      });

      test('throws CHECKOUT_VALIDATION for negative quantity', () => {
        const { createOrderFromCheckout } = setupMocks();
        try {
          createOrderFromCheckout(makeInput({
            cartItems: [{ product_id: 10, artisan_id: 5, quantity: -2, price: 20 }],
          }));
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('CHECKOUT_VALIDATION');
        }
      });

      test('throws CHECKOUT_VALIDATION for price that is Infinity', () => {
        const { createOrderFromCheckout } = setupMocks();
        try {
          createOrderFromCheckout(makeInput({
            cartItems: [{ product_id: 10, artisan_id: 5, quantity: 1, price: Infinity }],
          }));
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('CHECKOUT_VALIDATION');
          expect(e.message).toMatch(/pricing/i);
        }
      });

      test('throws CHECKOUT_VALIDATION for price that is NaN (string)', () => {
        const { createOrderFromCheckout } = setupMocks();
        try {
          createOrderFromCheckout(makeInput({
            cartItems: [{ product_id: 10, artisan_id: 5, quantity: 1, price: 'bad' }],
          }));
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('CHECKOUT_VALIDATION');
        }
      });

      test('accepts price of 0 (free item)', () => {
        const { createOrderFromCheckout } = setupMocks();
        const input = makeInput({
          cartItems: [{ product_id: 10, artisan_id: 5, quantity: 1, price: 0 }],
          totals: { total: 60 },
        });
        expect(() => createOrderFromCheckout(input)).not.toThrow();
      });

      // ── Stock decrease failures ───────────────────────────────────────────

      test('throws OUT_OF_STOCK when Product.decreaseStock returns null', () => {
        const { createOrderFromCheckout } = setupMocks({
          productDecreaseStock: jest.fn().mockReturnValue(null),
        });
        try {
          createOrderFromCheckout(makeInput());
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('OUT_OF_STOCK');
          expect(e.message).toContain('10');
        }
      });

      test('throws OUT_OF_STOCK when Product.decreaseStock returns changes === 0', () => {
        const { createOrderFromCheckout } = setupMocks({
          productDecreaseStock: jest.fn().mockReturnValue({ changes: 0 }),
        });
        try {
          createOrderFromCheckout(makeInput());
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('OUT_OF_STOCK');
        }
      });

      // ── Payment authorization ─────────────────────────────────────────────

      test('rethrows payment error and rolls back transaction', () => {
        const { createOrderFromCheckout, mockExec } = setupMocks({
          authorizePayment: jest.fn().mockImplementation(() => {
            const err = new Error('Card declined');
            err.code = 'PAYMENT_DECLINED';
            throw err;
          }),
        });
        try {
          createOrderFromCheckout(makeInput());
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('PAYMENT_DECLINED');
        }
        const execCommands = mockExec.mock.calls.map(c => c[0]);
        expect(execCommands).toContain('ROLLBACK');
      });

      test('calls Order.updatePaymentStatus and updateStatus on success', () => {
        const { createOrderFromCheckout, mockOrderUpdatePaymentStatus, mockOrderUpdateStatus } = setupMocks();
        createOrderFromCheckout(makeInput());
        expect(mockOrderUpdatePaymentStatus).toHaveBeenCalledWith(42, 'paid', expect.any(String));
        expect(mockOrderUpdateStatus).toHaveBeenCalledWith(42, 'confirmed');
      });

      // ── Transaction commands ──────────────────────────────────────────────

      test('issues BEGIN and COMMIT in happy path', () => {
        const { createOrderFromCheckout, mockExec } = setupMocks();
        createOrderFromCheckout(makeInput());
        const cmds = mockExec.mock.calls.map(c => c[0]);
        expect(cmds).toContain('BEGIN TRANSACTION');
        expect(cmds).toContain('COMMIT');
      });

      test('issues ROLLBACK when an error occurs mid-transaction', () => {
        const { createOrderFromCheckout, mockExec } = setupMocks({
          cartValidateItems: jest.fn().mockReturnValue([{ issue: 'stock' }]),
        });
        try { createOrderFromCheckout(makeInput()); } catch (_) {}
        const cmds = mockExec.mock.calls.map(c => c[0]);
        expect(cmds).toContain('ROLLBACK');
        expect(cmds).not.toContain('COMMIT');
      });

      // ── Notifications ─────────────────────────────────────────────────────

      test('calls Notification.orderPlaced for the customer', () => {
        const { createOrderFromCheckout, mockNotificationOrderPlaced } = setupMocks();
        createOrderFromCheckout(makeInput({ userId: 1 }));
        expect(mockNotificationOrderPlaced).toHaveBeenCalledWith(1, 42);
      });

      test('calls Notification.newOrderForArtisan for each unique artisan', () => {
        const { createOrderFromCheckout, mockNotificationNewOrderForArtisan } = setupMocks();
        const input = makeInput({
          cartItems: [
            { product_id: 10, artisan_id: 5, quantity: 1, price: 20 },
            { product_id: 11, artisan_id: 7, quantity: 1, price: 20 },
            { product_id: 12, artisan_id: 5, quantity: 1, price: 20 },
          ],
        });
        createOrderFromCheckout(input);
        expect(mockNotificationNewOrderForArtisan).toHaveBeenCalledTimes(2);
        const calledIds = mockNotificationNewOrderForArtisan.mock.calls.map(c => c[0]);
        expect(calledIds).toContain(5);
        expect(calledIds).toContain(7);
      });

      test('does not call newOrderForArtisan when artisan_id is not a valid integer', () => {
        const { createOrderFromCheckout, mockNotificationNewOrderForArtisan } = setupMocks();
        const input = makeInput({
          cartItems: [{ product_id: 10, artisan_id: 'bad', quantity: 1, price: 20 }],
        });
        createOrderFromCheckout(input);
        expect(mockNotificationNewOrderForArtisan).not.toHaveBeenCalled();
      });

      // ── Post-order cleanup ────────────────────────────────────────────────

      test('calls Shipment.create and Cart.clear after successful order', () => {
        const { createOrderFromCheckout, mockShipmentCreate, mockCartClear } = setupMocks();
        createOrderFromCheckout(makeInput({ userId: 1 }));
        expect(mockShipmentCreate).toHaveBeenCalledWith(42);
        expect(mockCartClear).toHaveBeenCalledWith(1);
      });

      // ── Return value ──────────────────────────────────────────────────────

      test('returns orderId and transactionRef on success', () => {
        const { createOrderFromCheckout } = setupMocks({
          authorizePayment: jest.fn().mockReturnValue({ status: 'authorized', transactionRef: 'TXN_ABC123' }),
        });
        const result = createOrderFromCheckout(makeInput());
        expect(result.orderId).toBe(42);
        expect(result.transactionRef).toBe('TXN_ABC123');
      });

      // ── Default country ───────────────────────────────────────────────────

      test('defaults shipping_country to Bahrain when not provided', () => {
        const { createOrderFromCheckout, mockOrderCreate } = setupMocks();
        const input = makeInput();
        delete input.checkoutData.shipping_country;
        createOrderFromCheckout(input);
        expect(mockOrderCreate.mock.calls[0][0].shipping_country).toBe('Bahrain');
      });

      test('uses provided shipping_country when specified', () => {
        const { createOrderFromCheckout, mockOrderCreate } = setupMocks();
        const input = makeInput();
        input.checkoutData.shipping_country = 'Saudi Arabia';
        createOrderFromCheckout(input);
        expect(mockOrderCreate.mock.calls[0][0].shipping_country).toBe('Saudi Arabia');
      });

      // ── Notes default ─────────────────────────────────────────────────────

      test('defaults notes to empty string when not provided', () => {
        const { createOrderFromCheckout, mockOrderCreate } = setupMocks();
        const input = makeInput();
        delete input.checkoutData.notes;
        createOrderFromCheckout(input);
        expect(mockOrderCreate.mock.calls[0][0].notes).toBe('');
      });

      // ── Rollback swallows rollback errors ─────────────────────────────────

      test('rethrows original error even if ROLLBACK itself throws', () => {
        let callCount = 0;
        const execFn = jest.fn().mockImplementation((cmd) => {
          callCount++;
          if (cmd === 'ROLLBACK') throw new Error('ROLLBACK failed');
        });
        const { createOrderFromCheckout } = setupMocks({
          getDb: jest.fn().mockReturnValue({ exec: execFn }),
          cartValidateItems: jest.fn().mockReturnValue([{ issue: 'stock' }]),
        });
        try {
          createOrderFromCheckout(makeInput());
          throw new Error('Should have thrown');
        } catch (e) {
          expect(e.code).toBe('OUT_OF_STOCK');
        }
      });

      // ── cartItems edge case ───────────────────────────────────────────────

      test('handles empty cartItems array (no items to add)', () => {
        const { createOrderFromCheckout } = setupMocks();
        expect(() => createOrderFromCheckout(makeInput({ cartItems: [] }))).not.toThrow();
      });

      // ── db.transaction path ───────────────────────────────────────────────

      test('uses db.transaction path when db.exec is not a function', () => {
        const mockTransaction = jest.fn();
        const { createOrderFromCheckout } = setupMocks({
          getDb: jest.fn().mockReturnValue({ transaction: mockTransaction }),
        });
        createOrderFromCheckout(makeInput());
        expect(mockTransaction).toHaveBeenCalled();
        const calls = mockTransaction.mock.calls.map(c => c[0]);
        expect(calls).toContain('BEGIN TRANSACTION');
        expect(calls).toContain('COMMIT');
      });
    });

    // ── Module exports ─────────────────────────────────────────────────────────

    describe('module exports', () => {
      test('exports createOrderFromCheckout as a function', () => {
        let mod;
        jest.isolateModules(() => { mod = require('../../services/checkoutService'); });
        expect(typeof mod.createOrderFromCheckout).toBe('function');
      });

      test('exports runTransactionCommand as a function', () => {
        let mod;
        jest.isolateModules(() => { mod = require('../../services/checkoutService'); });
        expect(typeof mod.runTransactionCommand).toBe('function');
      });

      test('does not export throwCheckoutError directly', () => {
        let mod;
        jest.isolateModules(() => { mod = require('../../services/checkoutService'); });
        expect(mod.throwCheckoutError).toBeUndefined();
      });
    });
  });
};
