const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');
const { getSafeRedirect } = require('../utils/redirect');

function getBackUrl(req, fallback = '/products') {
  return getSafeRedirect(req, fallback);
}

// View cart
exports.index = (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : null;
    const sessionId = !userId ? req.sessionID : null;

    const items = Cart.getItems(userId, sessionId);
    const totals = Cart.getTotal(userId, sessionId);

    // Parse product images
    items.forEach(item => {
      const images = JSON.parse(item.images || '[]');
      item.image = images[0] || '/images/placeholder-product.jpg';
    });

    // Get applied coupon from session
    const appliedCoupon = req.session.appliedCoupon || null;
    let discount = 0;
    if (appliedCoupon) {
      const validation = Coupon.validate(appliedCoupon.code, totals.total);
      if (validation.valid) {
        discount = validation.discount;
      } else {
        delete req.session.appliedCoupon;
      }
    }

    res.render('cart/index', {
      title: 'Shopping Cart - Craftify',
      items,
      subtotal: totals.total,
      itemCount: totals.item_count,
      shipping: totals.total > 50 ? 0 : 5,
      discount,
      appliedCoupon,
      total: totals.total + (totals.total > 50 ? 0 : 5) - discount
    });
  } catch (err) {
    console.error('Cart index error:', err);
    req.flash('error_msg', 'Error loading cart');
    res.redirect('/');
  }
};

// Add item to cart
exports.addItem = (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;
    const parsedQuantity = Number.parseInt(quantity, 10);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      if (req.xhr) return res.status(400).json({ success: false, message: 'Invalid quantity' });
      req.flash('error_msg', 'Invalid quantity');
      return res.redirect(getBackUrl(req));
    }

    const product = Product.findById(productId);
    if (!product || product.status !== 'approved') {
      if (req.xhr) return res.status(404).json({ success: false, message: 'Product not found' });
      req.flash('error_msg', 'Product not found');
      return res.redirect(getBackUrl(req));
    }

    if (product.stock < parsedQuantity) {
      if (req.xhr) return res.status(409).json({ success: false, message: 'Insufficient stock' });
      req.flash('error_msg', 'Not enough stock available');
      return res.redirect(getBackUrl(req));
    }

    const userId = req.session.user ? req.session.user.id : null;
    const sessionId = !userId ? req.sessionID : null;

    Cart.addItem(userId, sessionId, productId, parsedQuantity);
    const newCount = Cart.getCount(userId, sessionId);

    if (req.xhr) {
      return res.json({ success: true, message: 'Added to cart!', cartCount: newCount });
    }

    req.flash('success_msg', 'Item added to cart!');
    res.redirect(getBackUrl(req));
  } catch (err) {
    console.error('Add to cart error:', err);
    if (req.xhr) return res.status(500).json({ success: false, message: 'Error adding to cart' });
    req.flash('error_msg', 'Error adding item to cart');
    res.redirect(getBackUrl(req));
  }
};

// Update item quantity
exports.updateItem = (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const parsedQuantity = Number.parseInt(quantity, 10);

    if (!Number.isInteger(parsedQuantity)) {
      if (req.xhr) return res.status(400).json({ success: false, message: 'Invalid quantity' });
      req.flash('error_msg', 'Invalid quantity');
      return res.redirect('/cart');
    }

    const userId = req.session.user ? req.session.user.id : null;
    const sessionId = !userId ? req.sessionID : null;

    // If quantity is zero or less, treat as remove
    if (parsedQuantity <= 0) {
      Cart.removeItem(userId, sessionId, productId);
      if (req.xhr) {
        const totals = Cart.getTotal(userId, sessionId);
        return res.json({ success: true, subtotal: totals.total, cartCount: totals.item_count });
      }
      req.flash('success_msg', 'Item removed from cart');
      return res.redirect('/cart');
    }

    const product = Product.findById(productId);
    if (!product) {
      if (req.xhr) return res.status(404).json({ success: false, message: 'Product not found' });
      req.flash('error_msg', 'Product not found');
      return res.redirect('/cart');
    }

    if (parsedQuantity > product.stock) {
      if (req.xhr) return res.status(409).json({ success: false, message: `Only ${product.stock} items available` });
      req.flash('error_msg', `Only ${product.stock} items available`);
      return res.redirect('/cart');
    }

    Cart.updateItemQuantity(userId, sessionId, productId, parsedQuantity);
    const totals = Cart.getTotal(userId, sessionId);

    if (req.xhr) {
      return res.json({ success: true, subtotal: totals.total, cartCount: totals.item_count });
    }

    res.redirect('/cart');
  } catch (err) {
    console.error('Update cart error:', err);
    if (req.xhr) return res.status(500).json({ success: false, message: 'Error updating cart' });
    req.flash('error_msg', 'Error updating cart');
    res.redirect('/cart');
  }
};

// Remove item from cart
exports.removeItem = (req, res) => {
  try {
    const { productId } = req.body;

    const userId = req.session.user ? req.session.user.id : null;
    const sessionId = !userId ? req.sessionID : null;

    Cart.removeItem(userId, sessionId, productId);

    if (req.xhr) {
      const totals = Cart.getTotal(userId, sessionId);
      return res.json({ success: true, subtotal: totals.total, cartCount: totals.item_count });
    }

    req.flash('success_msg', 'Item removed from cart');
    res.redirect('/cart');
  } catch (err) {
    console.error('Remove from cart error:', err);
    if (req.xhr) return res.status(500).json({ success: false, message: 'Error removing item' });
    req.flash('error_msg', 'Error removing item');
    res.redirect('/cart');
  }
};

// Apply coupon
exports.applyCoupon = (req, res) => {
  try {
    const { code } = req.body;

    const userId = req.session.user ? req.session.user.id : null;
    const sessionId = !userId ? req.sessionID : null;

    const totals = Cart.getTotal(userId, sessionId);
    const validation = Coupon.validate(code, totals.total);

    if (!validation.valid) {
      if (req.xhr) return res.status(400).json({ success: false, message: validation.error });
      req.flash('error_msg', validation.error);
      return res.redirect('/cart');
    }

    req.session.appliedCoupon = {
      code: validation.coupon.code,
      discount: validation.discount,
      description: validation.coupon.description
    };

    if (req.xhr) {
      return res.json({ success: true, message: 'Coupon applied!', discount: validation.discount });
    }

    req.flash('success_msg', 'Coupon applied!');
    res.redirect('/cart');
  } catch (err) {
    console.error('Apply coupon error:', err);
    if (req.xhr) return res.status(500).json({ success: false, message: 'Error applying coupon' });
    req.flash('error_msg', 'Error applying coupon');
    res.redirect('/cart');
  }
};

// Remove coupon
exports.removeCoupon = (req, res) => {
  delete req.session.appliedCoupon;
  if (req.xhr) return res.json({ success: true });
  res.redirect('/cart');
};

// Clear cart
exports.clear = (req, res) => {
  try {
    const userId = req.session.user ? req.session.user.id : null;
    const sessionId = !userId ? req.sessionID : null;

    Cart.clear(userId, sessionId);
    delete req.session.appliedCoupon;

    if (req.xhr) return res.json({ success: true });

    req.flash('success_msg', 'Cart cleared');
    res.redirect('/cart');
  } catch (err) {
    console.error('Clear cart error:', err);
    if (req.xhr) return res.status(500).json({ success: false, message: 'Error clearing cart' });
    res.redirect('/cart');
  }
};
