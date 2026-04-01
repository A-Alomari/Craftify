const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Shipment = require('../models/Shipment');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const { v4: uuidv4 } = require('uuid');

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
      payment_method, notes 
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
        Coupon.use(couponCode);
      }
    }

    const shipping = totals.total > 50 ? 0 : 5;
    const totalAmount = totals.total + shipping - discount;

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
      Product.decreaseStock(item.product_id, item.quantity);
      artisanIds.add(item.artisan_id);
    });

    // Simulate payment
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

    items.forEach(item => {
      const images = JSON.parse(item.images || '[]');
      item.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('orders/confirmation', {
      title: 'Order Confirmed - Craftify',
      order,
      items,
      shipment
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

    res.render('orders/track', {
      title: `Track Order #${id} - Craftify`,
      order,
      shipment,
      shipmentHistory
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

    const items = Order.getItems(id);
    items.forEach(item => {
      Product.updateStock(item.product_id, item.quantity);
    });

    Order.cancel(id);
    req.flash('success_msg', 'Order cancelled successfully');
    res.redirect('/orders');
  } catch (err) {
    console.error('Cancel order error:', err);
    req.flash('error_msg', 'Error cancelling order');
    res.redirect('/orders');
  }
};
