const database = require('../config/database');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Shipment = require('../models/Shipment');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const { authorizePayment } = require('./paymentService');

function runTransactionCommand(db, command) {
  if (typeof db.exec === 'function') {
    db.exec(command);
    return;
  }

  if (typeof db.transaction === 'function') {
    db.transaction(command);
    return;
  }

  throw new Error('Database transaction command is not supported');
}

function throwCheckoutError(message, code) {
  const err = new Error(message);
  err.code = code;
  throw err;
}

function createOrderFromCheckout({ userId, checkoutData, cartItems, totals, appliedCoupon }) {
  const shipping = totals.total > 50 ? 0 : 5;
  let discount = 0;
  let couponCode = null;

  const ownItem = (cartItems || []).find((item) => Number.parseInt(item.artisan_id, 10) === Number.parseInt(userId, 10));
  if (ownItem) {
    throwCheckoutError('You cannot buy your own product', 'CHECKOUT_VALIDATION');
  }

  if (appliedCoupon) {
    const validation = Coupon.validate(appliedCoupon.code, totals.total, cartItems || []);
    if (validation.valid) {
      discount = validation.discount;
      couponCode = appliedCoupon.code;
    }
  }

  const totalAmount = totals.total + shipping - discount;
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throwCheckoutError('Order total is invalid', 'CHECKOUT_VALIDATION');
  }

  const db = database.getDb();
  let inTransaction = false;

  try {
    runTransactionCommand(db, 'BEGIN TRANSACTION');
    inTransaction = true;

    // Re-check stock inside the transaction to prevent overselling.
    const freshStockIssues = Cart.validateItems(userId);
    if (freshStockIssues.length > 0) {
      throwCheckoutError('Some items are no longer in stock', 'OUT_OF_STOCK');
    }

    const order = Order.create({
      user_id: userId,
      shipping_address: checkoutData.shipping_address,
      shipping_city: checkoutData.shipping_city,
      shipping_postal: checkoutData.shipping_postal,
      shipping_country: checkoutData.shipping_country || 'Bahrain',
      total_amount: totalAmount,
      subtotal: totals.total,
      shipping_cost: shipping,
      discount_amount: discount,
      coupon_code: couponCode,
      payment_method: checkoutData.payment_method,
      notes: checkoutData.notes || ''
    });

    const artisanIds = new Set();

    cartItems.forEach((item) => {
      const productId = Number.parseInt(item.product_id, 10);
      const artisanId = Number.parseInt(item.artisan_id, 10);
      const quantity = Number.parseInt(item.quantity, 10);
      const unitPrice = Number.parseFloat(item.price);

      if (!Number.isInteger(productId) || productId <= 0) {
        throwCheckoutError('Cart contains an invalid item', 'CHECKOUT_VALIDATION');
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throwCheckoutError('Cart quantity is invalid', 'CHECKOUT_VALIDATION');
      }
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throwCheckoutError('Cart pricing is invalid', 'CHECKOUT_VALIDATION');
      }

      Order.addItem(order.id, {
        product_id: productId,
        artisan_id: Number.isInteger(artisanId) ? artisanId : null,
        quantity,
        unit_price: unitPrice
      });

      const stockUpdate = Product.decreaseStock(productId, quantity);
      if (!stockUpdate || stockUpdate.changes === 0) {
        throwCheckoutError(`Insufficient stock for product ${productId}`, 'OUT_OF_STOCK');
      }

      if (Number.isInteger(artisanId)) {
        artisanIds.add(artisanId);
      }
    });

    const payment = authorizePayment({
      payment_method: checkoutData.payment_method,
      card_number: checkoutData.card_number,
      card_expiry: checkoutData.card_expiry,
      card_cvc: checkoutData.card_cvc,
      total_amount: totalAmount,
      idempotency_key: checkoutData.checkout_nonce || null
    });

    Order.updatePaymentStatus(order.id, 'paid', payment.transactionRef);
    Order.updateStatus(order.id, 'confirmed');

    if (couponCode) {
      Coupon.use(couponCode);
    }

    Shipment.create(order.id);
    Cart.clear(userId);

    Notification.orderPlaced(userId, order.id);
    artisanIds.forEach((artisanId) => {
      Notification.newOrderForArtisan(artisanId, order.id);
    });

    runTransactionCommand(db, 'COMMIT');
    inTransaction = false;

    return {
      orderId: order.id,
      transactionRef: payment.transactionRef
    };
  } catch (err) {
    if (inTransaction) {
      try {
        runTransactionCommand(db, 'ROLLBACK');
      } catch (rollbackErr) {
        // Ignore rollback failures and rethrow original checkout error.
      }
    }
    throw err;
  }
}

module.exports = {
  createOrderFromCheckout,
  runTransactionCommand
};
