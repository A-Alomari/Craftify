const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Shipment = require('../models/Shipment');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const { v4: uuidv4 } = require('uuid');

function validateCheckoutInput(body) {
  const errors = [];
  if (!body.shipping_address || !body.shipping_city) {
    errors.push('Shipping address and city are required');
  }
  if (!body.payment_method) {
    errors.push('Payment method is required');
  }
  return errors;
}

function simulateMockPayment({ payment_method, card_number, card_expiry, card_cvc, total_amount }) {
  if (payment_method !== 'card') {
    return { success: true };
  }

  if (!card_number || !card_expiry || !card_cvc) {
    return { success: false, error: 'Card details are required for card payments' };
  }

  const normalizedNumber = String(card_number).replace(/\s+/g, '');
  if (!/^\d{13,19}$/.test(normalizedNumber)) {
    return { success: false, error: 'Card number must contain 13 to 19 digits' };
  }
  if (!/^\d{2}\/\d{2}$/.test(String(card_expiry))) {
    return { success: false, error: 'Card expiry must use MM/YY format' };
  }
  if (!/^\d{3,4}$/.test(String(card_cvc))) {
    return { success: false, error: 'Card CVC is invalid' };
  }
  if (normalizedNumber.endsWith('0002')) {
    return { success: false, error: 'Mock payment was declined. Please try a different test card.' };
  }
  if (total_amount <= 0) {
    return { success: false, error: 'Order total is invalid' };
  }

  return { success: true };
}

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

// Show checkout page
exports.checkout = (req, res) => {
  try {
    const userId = req.session.user.id;
    const items = Cart.getItems(userId);

    if (items.length === 0) {
      req.flash('error_msg', 'Your cart is empty');
      return res.redirect('/cart');
    }

    const stockIssues = Cart.validateItems(userId);
    if (stockIssues.length > 0) {
      req.flash('error_msg', `Stock issue: ${stockIssues[0].name} only has ${stockIssues[0].available} available`);
      return res.redirect('/cart');
    }

    const totals = Cart.getTotal(userId);
    const appliedCoupon = req.session.appliedCoupon;
    let discount = 0;
    if (appliedCoupon) {
      const validation = Coupon.validate(appliedCoupon.code, totals.total);
      if (validation.valid) discount = validation.discount;
    }

    const shipping = totals.total > 50 ? 0 : 5;

    items.forEach(item => {
      const images = JSON.parse(item.images || '[]');
      item.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('orders/checkout', {
      title: 'Checkout - Craftify',
      items,
      subtotal: totals.total,
      shipping,
      discount,
      appliedCoupon,
      total: totals.total + shipping - discount,
      user: req.session.user
    });
  } catch (err) {
    console.error('Checkout error:', err);
    req.flash('error_msg', 'Error loading checkout');
    res.redirect('/cart');
  }
};

// Process order
exports.placeOrder = (req, res) => {
  try {
    const { 
      shipping_address, shipping_city, shipping_postal, shipping_country,
      payment_method, notes, card_number, card_expiry, card_cvc
    } = req.body;

    const userId = req.session.user.id;
    const items = Cart.getItems(userId);

    if (items.length === 0) {
      req.flash('error_msg', 'Your cart is empty');
      return res.redirect('/cart');
    }

    const stockIssues = Cart.validateItems(userId);
    if (stockIssues.length > 0) {
      req.flash('error_msg', 'Some items are out of stock');
      return res.redirect('/cart');
    }

    const totals = Cart.getTotal(userId);
    const appliedCoupon = req.session.appliedCoupon;
    let discount = 0;
    let couponCode = null;

    if (appliedCoupon) {
      const validation = Coupon.validate(appliedCoupon.code, totals.total);
      if (validation.valid) {
        discount = validation.discount;
        couponCode = appliedCoupon.code;
      }
    }

    const shipping = totals.total > 50 ? 0 : 5;
    const totalAmount = totals.total + shipping - discount;
    const validationErrors = validateCheckoutInput(req.body);

    if (validationErrors.length > 0) {
      req.flash('error_msg', validationErrors.join('. '));
      return res.redirect('/orders/checkout');
    }

    const paymentResult = simulateMockPayment({
      payment_method,
      card_number,
      card_expiry,
      card_cvc,
      total_amount: totalAmount
    });

    if (!paymentResult.success) {
      req.flash('error_msg', paymentResult.error);
      return res.redirect('/orders/checkout');
    }

    // Wrap order creation and stock decrement in a transaction to prevent overselling
    const { getDb } = require('../config/database');
    const db = getDb();
    let inTransaction = false;
    
    try {
      runTransactionCommand(db, 'BEGIN TRANSACTION');
      inTransaction = true;
      
      // Re-validate stock inside transaction
      const freshStockIssues = Cart.validateItems(userId);
      if (freshStockIssues.length > 0) {
        try { runTransactionCommand(db, 'ROLLBACK'); } catch (e) { /* ignore */ }
        inTransaction = false;
        req.flash('error_msg', 'Some items are no longer in stock');
        return res.redirect('/cart');
      }

      const order = Order.create({
        user_id: userId,
        shipping_address,
        shipping_city,
        shipping_postal,
        shipping_country: shipping_country || 'Bahrain',
        total_amount: totalAmount,
        subtotal: totals.total,
        shipping_cost: shipping,
        discount_amount: discount,
        coupon_code: couponCode,
        payment_method,
        notes
      });

      const artisanIds = new Set();
      items.forEach(item => {
        Order.addItem(order.id, {
          product_id: item.product_id,
          artisan_id: item.artisan_id,
          quantity: item.quantity,
          unit_price: item.price
        });

        const stockUpdate = Product.decreaseStock(item.product_id, item.quantity);
        if (!stockUpdate || stockUpdate.changes === 0) {
          throw new Error(`Insufficient stock for product ${item.product_id}`);
        }

        artisanIds.add(item.artisan_id);
      });

      runTransactionCommand(db, 'COMMIT');
      inTransaction = false;

      if (couponCode) {
        Coupon.use(couponCode);
      }

      const transactionRef = 'TXN' + uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
      Order.updatePaymentStatus(order.id, 'paid', transactionRef);
      Order.updateStatus(order.id, 'confirmed');

      Shipment.create(order.id);
      Cart.clear(userId);
      delete req.session.appliedCoupon;

      Notification.orderPlaced(userId, order.id);
      artisanIds.forEach(artisanId => {
        Notification.newOrderForArtisan(artisanId, order.id);
      });

      res.redirect(`/orders/${order.id}/confirmation`);
    } catch (txErr) {
      // Only rollback if transaction is still active
      if (inTransaction) {
        try { runTransactionCommand(db, 'ROLLBACK'); } catch (rbErr) { /* already rolled back */ }
      }
      throw txErr;
    }
  } catch (err) {
    console.error('Place order error:', err);
    req.flash('error_msg', 'Error processing order');
    res.redirect('/cart');
  }
};

// Order confirmation
exports.confirmation = (req, res) => {
  try {
    const { id } = req.params;
    const order = Order.findById(id);

    if (!order || order.user_id !== req.session.user.id) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/orders');
    }

    const items = Order.getItems(id);
    const shipment = Shipment.findByOrderId(id);
    const User = require('../models/User');
    const user = User.findById(req.session.user.id);

    items.forEach(item => {
      const images = JSON.parse(item.images || '[]');
      item.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('orders/confirmation', {
      title: 'Order Confirmed - Craftify',
      order,
      items,
      shipment,
      user
    });
  } catch (err) {
    console.error('Order confirmation error:', err);
    res.redirect('/orders');
  }
};

// Order history
exports.index = (req, res) => {
  try {
    const orders = Order.findByUserId(req.session.user.id);

    // Attach lightweight item previews so the order-history layout can render thumbnail stacks.
    orders.forEach((order) => {
      const previewItems = (Order.getItems(order.id) || []).slice(0, 3).map((item) => {
        let image = '/images/placeholder-product.jpg';
        try {
          const images = JSON.parse(item.images || '[]');
          if (images && images.length > 0) image = images[0];
        } catch (e) {
          image = '/images/placeholder-product.jpg';
        }

        return {
          product_name: item.product_name,
          image
        };
      });

      order.previewItems = previewItems;
    });

    res.render('orders/index', {
      title: 'My Orders - Craftify',
      orders
    });
  } catch (err) {
    console.error('Orders index error:', err);
    req.flash('error_msg', 'Error loading orders');
    res.redirect('/');
  }
};

// Single order details
exports.show = (req, res) => {
  try {
    const { id } = req.params;
    const order = Order.findById(id);

    if (!order || order.user_id !== req.session.user.id) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/orders');
    }

    const items = Order.getItems(id);
    const shipment = Shipment.findByOrderId(id);
    const shipmentHistory = shipment ? Shipment.getHistory(shipment.id) : [];

    items.forEach(item => {
      const images = JSON.parse(item.images || '[]');
      item.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('orders/show', {
      title: `Order #${id} - Craftify`,
      order,
      items,
      shipment,
      shipmentHistory
    });
  } catch (err) {
    console.error('Order show error:', err);
    res.redirect('/orders');
  }
};

// Track order
exports.track = (req, res) => {
  try {
    const { id } = req.params;
    const order = Order.findById(id);

    if (!order || order.user_id !== req.session.user.id) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/orders');
    }

    const shipment = Shipment.findByOrderId(id);
    const shipmentHistory = shipment ? Shipment.getHistory(shipment.id) : [];
    const items = Order.getItems(id);

    items.forEach((item) => {
      const images = JSON.parse(item.images || '[]');
      item.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('orders/track', {
      title: `Track Order #${id} - Craftify`,
      order,
      shipment,
      shipmentHistory,
      items
    });
  } catch (err) {
    console.error('Track order error:', err);
    res.redirect('/orders');
  }
};

// Cancel order
exports.cancel = (req, res) => {
  try {
    const { id } = req.params;
    const order = Order.findById(id);

    if (!order || order.user_id !== req.session.user.id) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/orders');
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      req.flash('error_msg', 'Order cannot be cancelled');
      return res.redirect(`/orders/${id}`);
    }

    const { getDb } = require('../config/database');
    const db = getDb();
    let inTransaction = false;

    try {
      runTransactionCommand(db, 'BEGIN TRANSACTION');
      inTransaction = true;

      const items = Order.getItems(id);
      items.forEach(item => {
        Product.updateStock(item.product_id, item.quantity);
      });

      Order.cancel(id);
      runTransactionCommand(db, 'COMMIT');
      inTransaction = false;
    } catch (txErr) {
      if (inTransaction) {
        try { runTransactionCommand(db, 'ROLLBACK'); } catch (rollbackErr) { /* no-op */ }
      }
      throw txErr;
    }

    req.flash('success_msg', 'Order cancelled successfully');
    res.redirect('/orders');
  } catch (err) {
    console.error('Cancel order error:', err);
    req.flash('error_msg', 'Error cancelling order');
    res.redirect('/orders');
  }
};
