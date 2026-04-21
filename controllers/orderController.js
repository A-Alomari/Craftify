const Cart = require('../models/Cart');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Shipment = require('../models/Shipment');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');
const { validateCheckoutInput } = require('../utils/sanitizer');
const { createOrderFromCheckout } = require('../services/checkoutService');

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
    // WHY: Reject the order if the session has a nonce but the form omits it entirely —
    // this closes a double-submit / replay window where an attacker submits without the nonce.
    if (sessionCheckoutNonce && !checkout_nonce) {
      req.flash('error_msg', 'Checkout session expired. Please review your cart and try again.');
      return res.redirect('/orders/checkout');
    }
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
    const PAGE_SIZE = 10;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const status = req.query.status || '';
    const sort = req.query.sort === 'asc' ? 'asc' : 'desc';
    const search = (req.query.search || '').trim();

    const filters = { sort };
    if (status && status !== 'all') filters.status = status;
    if (search) filters.search = search;

    const totalCount = Order.countByUserId(req.session.user.id, filters);
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);

    const orders = Order.findByUserId(req.session.user.id, {
      ...filters,
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE
    });

    const orderIds = orders.map(order => order.id);
    const previewItemsByOrder = Order.getPreviewItemsForOrders(orderIds, 3);
    orders.forEach((order) => {
      order.previewItems = previewItemsByOrder[order.id] || [];
    });

    const queryParts = [];
    if (status) queryParts.push(`status=${encodeURIComponent(status)}`);
    if (sort !== 'desc') queryParts.push(`sort=${sort}`);
    if (search) queryParts.push(`search=${encodeURIComponent(search)}`);

    res.render('orders/index', {
      title: 'My Orders - Craftify',
      orders,
      filters: { status, sort, search },
      pagination: {
        current: currentPage,
        total: totalPages,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages
      },
      queryString: queryParts.join('&')
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
      if (order.status === 'delivered' && item.product_id) {
        const { canReview, hasReviewed } = Review.canReview(req.session.user.id, item.product_id);
        item.canReview = canReview;
        item.hasReviewed = hasReviewed;
      }
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

    // WHY: cancelWithRestock handles the transaction internally, keeping all DB logic in the model
    Order.cancelWithRestock(id);

    req.flash('success_msg', 'Order cancelled successfully');
    res.redirect('/orders');
  } catch (err) {
    console.error('Cancel order error:', err);
    req.flash('error_msg', 'Error cancelling order');
    res.redirect('/orders');
  }
};

// Get order items with canReview info (AJAX)
exports.getItems = (req, res) => {
  try {
    const { id } = req.params;
    const order = Order.findById(id);
    if (!order || order.user_id !== req.session.user.id) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const items = Order.getItems(id);
    items.forEach(item => {
      const images = JSON.parse(item.images || '[]');
      item.image = images[0] || '/images/placeholder-product.jpg';
      const { canReview, hasReviewed } = Review.canReview(req.session.user.id, item.product_id);
      item.canReview = canReview;
      item.hasReviewed = hasReviewed;
    });
    return res.json({ success: true, items, order });
  } catch (err) {
    console.error('Get order items error:', err);
    return res.status(500).json({ success: false });
  }
};

// Reorder: add previous order items back to cart
exports.reorder = (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;
    const order = Order.findById(id);
    if (!order || order.user_id !== userId) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const items = Order.getItems(id);
    const added = [];
    const outOfStock = [];

    items.forEach(item => {
      const product = Product.findById(item.product_id);
      if (!product || product.status !== 'approved') {
        outOfStock.push({ name: item.product_name, reason: 'unavailable' });
        return;
      }
      if (product.stock <= 0) {
        outOfStock.push({ name: item.product_name, reason: 'out_of_stock' });
        return;
      }
      const existingQty = Cart.getItemQuantity(userId, null, item.product_id) || 0;
      const canAdd = product.stock - existingQty;
      if (canAdd <= 0) {
        outOfStock.push({ name: item.product_name, reason: 'already_max' });
        return;
      }
      const qtyToAdd = Math.min(item.quantity, canAdd);
      Cart.addItem(userId, null, item.product_id, qtyToAdd);
      added.push({ name: item.product_name, quantity: qtyToAdd });
      if (qtyToAdd < item.quantity) {
        outOfStock.push({ name: item.product_name, reason: 'partial', available: qtyToAdd, wanted: item.quantity });
      }
    });

    const cartCount = Cart.getCount(userId, null);
    if (req.xhr) {
      return res.json({ success: true, added, outOfStock, cartCount });
    }
    req.flash('success_msg', outOfStock.length > 0 ? 'Some items were added to your cart' : 'Items added to cart');
    return res.redirect('/cart');
  } catch (err) {
    console.error('Reorder error:', err);
    if (req.xhr) return res.status(500).json({ success: false, message: 'Error reordering' });
    req.flash('error_msg', 'Error reordering');
    return res.redirect('/orders');
  }
};
