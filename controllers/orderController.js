const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Shipment = require('../models/Shipment');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const { validateCheckoutInput } = require('../utils/sanitizer');
const { createOrderFromCheckout, runTransactionCommand } = require('../services/checkoutService');

// Show checkout page
exports.checkout = (req, res) => {
  try {
    const userId = req.session.user.id;
    const items = Cart.getItems(userId);

    if (items.length === 0) {
      req.flash('error_msg', 'Your cart is empty');
      return res.redirect('/cart');
    }

    if (req.session.user.role === 'artisan') {
      const ownItem = items.find((item) => Number.parseInt(item.artisan_id, 10) === Number.parseInt(userId, 10));
      if (ownItem) {
        req.flash('error_msg', 'You cannot buy your own product. Remove it from the cart to continue.');
        return res.redirect('/cart');
      }
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
      const validation = Coupon.validate(appliedCoupon.code, totals.total, items);
      if (validation.valid) discount = validation.discount;
    }

    const shipping = totals.total > 50 ? 0 : 5;
    const checkoutNonce = uuidv4();
    req.session.checkoutNonce = checkoutNonce;

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
      user: User.findById(userId) || req.session.user,
      checkoutNonce
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
    const { checkout_nonce } = req.body;

    const userId = req.session.user.id;
    const items = Cart.getItems(userId);

    if (items.length === 0) {
      req.flash('error_msg', 'Your cart is empty');
      return res.redirect('/cart');
    }

    if (req.session.user.role === 'artisan') {
      const ownItem = items.find((item) => Number.parseInt(item.artisan_id, 10) === Number.parseInt(userId, 10));
      if (ownItem) {
        req.flash('error_msg', 'You cannot buy your own product. Remove it from the cart to continue.');
        return res.redirect('/cart');
      }
    }

    const stockIssues = Cart.validateItems(userId);
    if (stockIssues.length > 0) {
      req.flash('error_msg', 'Some items are out of stock');
      return res.redirect('/cart');
    }

    const { errors: validationErrors, sanitized: checkoutData } = validateCheckoutInput(req.body);
    if (validationErrors.length > 0) {
      req.flash('error_msg', validationErrors.join('. '));
      return res.redirect('/orders/checkout');
    }

    const sessionCheckoutNonce = req.session.checkoutNonce;
    if (sessionCheckoutNonce && checkout_nonce && checkout_nonce !== sessionCheckoutNonce) {
      req.flash('error_msg', 'Checkout session expired. Please review your cart and try again.');
      return res.redirect('/orders/checkout');
    }

    if (sessionCheckoutNonce && checkout_nonce && checkout_nonce === sessionCheckoutNonce) {
      delete req.session.checkoutNonce;
    }

    const totals = Cart.getTotal(userId);
    try {
      const result = createOrderFromCheckout({
        userId,
        checkoutData: {
          ...checkoutData,
          checkout_nonce
        },
        cartItems: items,
        totals,
        appliedCoupon: req.session.appliedCoupon
      });

      delete req.session.appliedCoupon;
      res.redirect(`/orders/${result.orderId}/confirmation`);
    } catch (checkoutErr) {
      if (checkoutErr?.code === 'OUT_OF_STOCK') {
        req.flash('error_msg', 'Some items are no longer in stock');
        return res.redirect('/cart');
      }

      if (['CHECKOUT_VALIDATION', 'PAYMENT_VALIDATION', 'PAYMENT_DECLINED', 'PAYMENT_PROVIDER_UNAVAILABLE'].includes(checkoutErr?.code)) {
        req.flash('error_msg', checkoutErr.message);
        return res.redirect('/orders/checkout');
      }

      throw checkoutErr;
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

    const orderIds = orders.map(order => order.id);
    const previewItemsByOrder = Order.getPreviewItemsForOrders(orderIds, 3);
    orders.forEach((order) => {
      order.previewItems = previewItemsByOrder[order.id] || [];
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
