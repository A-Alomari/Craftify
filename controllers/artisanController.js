const User = require('../models/User');
const ArtisanProfile = require('../models/ArtisanProfile');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const Review = require('../models/Review');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const { validateProductInput } = require('../utils/sanitizer');

// Dashboard
exports.dashboard = (req, res) => {
  try {
    const artisanId = req.session.user.id;
    const profile = ArtisanProfile.findByUserId(artisanId);
    const stats = ArtisanProfile.getStats(artisanId);
    const recentOrders = Order.getRecentByArtisan(artisanId, 5);
    const activeAuctions = Auction.findAll({ artisan_id: artisanId, status: 'active', limit: 5 });
    const monthlyRevenue = Order.getMonthlyRevenueByArtisan(artisanId, 6);

    // Parse product image for recent orders
    recentOrders.forEach(o => {
      const imgs = JSON.parse(o.product_images || '[]');
      o.product_image = imgs[0] || '/images/placeholder-product.jpg';
    });

    res.render('artisan/dashboard', {
      title: 'Artisan Dashboard - Craftify',
      profile,
      stats,
      recentOrders,
      activeAuctions,
      monthlyRevenue
    });
  } catch (err) {
    console.error('Artisan dashboard error:', err);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
};

exports.pending = (req, res) => {
  const profile = ArtisanProfile.findByUserId(req.session.user.id);
  res.render('artisan/pending', {
    title: 'Pending Approval - Craftify',
    profile
  });
};

exports.profile = (req, res) => {
  const profile = ArtisanProfile.findByUserId(req.session.user.id);
  res.render('artisan/profile', {
    title: 'My Profile - Craftify',
    profile
  });
};

exports.updateProfile = (req, res) => {
  try {
    const { shop_name, bio, return_policy } = req.body;
    const userId = req.session.user.id;

    if (req.body.name) {
      User.update(userId, { name: req.body.name, phone: req.body.phone });
    }

    const updates = { shop_name, bio, return_policy };
    if (req.file) {
      updates.profile_image = `/uploads/${req.file.filename}`;
    }

    ArtisanProfile.update(userId, updates);
    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/artisan/profile');
  } catch (err) {
    console.error('Update profile error:', err);
    req.flash('error_msg', 'Error updating profile');
    res.redirect('/artisan/profile');
  }
};

exports.products = (req, res) => {
  try {
    const { page = 1 } = req.query;
    const limit = 10;
    const offset = (page - 1) * limit;
    
    const products = Product.getByArtisan(req.session.user.id, { limit, offset });
    const totalProducts = Product.count({ artisan_id: req.session.user.id });
    const totalPages = Math.ceil(totalProducts / limit);
    const categories = Category.findAll();

    res.render('artisan/products', {
      title: 'My Products - Craftify',
      products,
      categories,
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Artisan products error:', err);
    res.redirect('/artisan/dashboard');
  }
};

exports.newProduct = (req, res) => {
  const categories = Category.findAll();
  res.render('artisan/product-form', {
    title: 'Add Product - Craftify',
    product: null,
    categories
  });
};

exports.createProduct = (req, res) => {
  try {
    const { name, description, price, stock, category_id, weight, tags, length_cm, width_cm, height_cm } = req.body;

    // Sanitize and validate input
    const { errors, sanitized } = validateProductInput(req.body);
    if (errors.length > 0) {
      req.flash('error_msg', errors.join('. '));
      return res.redirect('/artisan/products/new');
    }

    let images = [];
    if (req.files && req.files.length > 0) {
      images = req.files.map(f => `/uploads/${f.filename}`);
    }

    Product.create({
      artisan_id: req.session.user.id,
      name: sanitized.name,
      description: sanitized.description,
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      category_id: category_id || null,
      images: JSON.stringify(images),
      status: 'pending',
      weight: weight ? parseFloat(weight) : null,
      tags: tags ? tags.trim() : null,
      length_cm: length_cm ? parseFloat(length_cm) : null,
      width_cm: width_cm ? parseFloat(width_cm) : null,
      height_cm: height_cm ? parseFloat(height_cm) : null
    });

    req.flash('success_msg', 'Product created! It will be visible after admin approval.');
    res.redirect('/artisan/products');
  } catch (err) {
    console.error('Create product error:', err);
    req.flash('error_msg', 'Error creating product');
    res.redirect('/artisan/products/new');
  }
};

exports.editProduct = (req, res) => {
  try {
    const { id } = req.params;
    const product = Product.findById(id);

    if (!product || product.artisan_id !== req.session.user.id) {
      req.flash('error_msg', 'Product not found');
      return res.redirect('/artisan/products');
    }

    const categories = Category.findAll();
    product.imageArray = JSON.parse(product.images || '[]');

    res.render('artisan/product-form', {
      title: 'Edit Product - Craftify',
      product,
      categories
    });
  } catch (err) {
    console.error('Edit product error:', err);
    res.redirect('/artisan/products');
  }
};

exports.updateProduct = (req, res) => {
  try {
    const { id } = req.params;
    const product = Product.findById(id);

    if (!product || product.artisan_id !== req.session.user.id) {
      req.flash('error_msg', 'Product not found');
      return res.redirect('/artisan/products');
    }

    const { name, description, price, stock, category_id, weight, tags, length_cm, width_cm, height_cm } = req.body;

    // Sanitize and validate input
    const { errors, sanitized } = validateProductInput(req.body);
    if (errors.length > 0) {
      req.flash('error_msg', errors.join('. '));
      return res.redirect(`/artisan/products/${id}/edit`);
    }

    let images = JSON.parse(product.images || '[]');
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(f => `/uploads/${f.filename}`);
      images = [...images, ...newImages];
    }

    const updatedProduct = Product.update(id, {
      name: sanitized.name,
      description: sanitized.description,
      price: parseFloat(price),
      stock: parseInt(stock) || 0,
      category_id: category_id || null,
      images: JSON.stringify(images),
      weight: weight ? parseFloat(weight) : null,
      tags: tags ? tags.trim() : null,
      length_cm: length_cm ? parseFloat(length_cm) : null,
      width_cm: width_cm ? parseFloat(width_cm) : null,
      height_cm: height_cm ? parseFloat(height_cm) : null
    });

    req.flash('success_msg', 'Product updated successfully');
    if (updatedProduct && updatedProduct.status === 'approved') {
      res.redirect(`/products/${id}`);
    } else {
      res.redirect('/artisan/products');
    }
  } catch (err) {
    console.error('Update product error:', err);
    req.flash('error_msg', 'Error updating product');
    res.redirect('/artisan/products');
  }
};

exports.deleteProduct = (req, res) => {
  try {
    const { id } = req.params;
    const product = Product.findById(id);

    if (!product || product.artisan_id !== req.session.user.id) {
      if (req.xhr) return res.status(404).json({ success: false, message: 'Product not found' });
      req.flash('error_msg', 'Product not found');
      return res.redirect('/artisan/products');
    }

    Product.delete(id);

    if (req.xhr) return res.json({ success: true });

    req.flash('success_msg', 'Product deleted');
    res.redirect('/artisan/products');
  } catch (err) {
    console.error('Delete product error:', err);
    if (req.xhr) return res.status(500).json({ success: false, message: 'Error deleting product' });
    res.redirect('/artisan/products');
  }
};

exports.orders = (req, res) => {
  try {
    const orders = Order.findAll({ artisan_id: req.session.user.id });

    res.render('artisan/orders', {
      title: 'Orders - Craftify',
      orders
    });
  } catch (err) {
    console.error('Artisan orders error:', err);
    res.redirect('/artisan/dashboard');
  }
};

exports.orderDetail = (req, res) => {
  try {
    const { id } = req.params;
    const order = Order.findById(id);

    if (!order) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/artisan/orders');
    }

    const items = Order.getItemsByArtisan(id, req.session.user.id);
    if (items.length === 0) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/artisan/orders');
    }

    items.forEach(item => {
      const images = JSON.parse(item.images || '[]');
      item.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('artisan/order-detail', {
      title: `Order #${id} - Craftify`,
      order,
      items
    });
  } catch (err) {
    console.error('Order detail error:', err);
    res.redirect('/artisan/orders');
  }
};

exports.updateOrderStatus = (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      if (req.xhr) return res.status(400).json({ success: false, message: 'Invalid order ID' });
      req.flash('error_msg', 'Invalid order ID');
      return res.redirect('/artisan/orders');
    }

    const { status } = req.body;
    const allowedStatuses = new Set(['processing', 'shipped', 'delivered']);
    if (!allowedStatuses.has(status)) {
      if (req.xhr) return res.status(400).json({ success: false, message: 'Invalid status' });
      req.flash('error_msg', 'Invalid status');
      return res.redirect(`/artisan/orders/${id}`);
    }

    const artisanItems = Order.getItemsByArtisan(id, req.session.user.id);
    if (!artisanItems || artisanItems.length === 0) {
      if (req.xhr) return res.status(404).json({ success: false, message: 'Order not found' });
      req.flash('error_msg', 'Order not found');
      return res.redirect('/artisan/orders');
    }

    Order.updateStatus(id, status);
    const order = Order.findById(id);

    Notification.orderStatusChanged(order.user_id, id, status);

    if (req.xhr) return res.json({ success: true });

    req.flash('success_msg', 'Order status updated');
    res.redirect(`/artisan/orders/${id}`);
  } catch (err) {
    console.error('Update order status error:', err);
    if (req.xhr) return res.status(500).json({ success: false, message: 'Error updating status' });
    res.redirect('/artisan/orders');
  }
};

exports.auctions = (req, res) => {
  try {
    const auctions = Auction.findAll({ artisan_id: req.session.user.id });

    auctions.forEach(a => {
      // FIX: fall back to a.images for standalone auctions that have no linked product.
      const images = JSON.parse(a.product_images || a.images || '[]');
      a.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('artisan/auctions', {
      title: 'My Auctions - Craftify',
      auctions
    });
  } catch (err) {
    console.error('Artisan auctions error:', err);
    res.redirect('/artisan/dashboard');
  }
};

exports.newAuction = (req, res) => {
  const products = Product.findAll({ artisan_id: req.session.user.id, status: 'approved' });
  res.render('artisan/auction-form', {
    title: 'Create Auction - Craftify',
    auction: null,
    products
  });
};

exports.createAuction = (req, res) => {
  try {
    const { product_id, title, description, starting_bid, reserve_price, bid_increment, start_time, end_time } = req.body;

    // Product is optional — if provided, verify ownership
    let verifiedProductId = null;
    if (product_id) {
      const product = Product.findById(product_id);
      if (!product || product.artisan_id !== req.session.user.id) {
        req.flash('error_msg', 'Invalid product selected');
        return res.redirect('/artisan/auctions/new');
      }
      verifiedProductId = product_id;
    }

    if (!title && !verifiedProductId) {
      req.flash('error_msg', 'Please provide an auction title or select a product');
      return res.redirect('/artisan/auctions/new');
    }

    // Handle uploaded images for standalone auctions
    let images = '[]';
    if (req.files && req.files.length > 0) {
      images = JSON.stringify(req.files.map(f => `/uploads/${f.filename}`));
    }

    const newAuction = Auction.create({
      product_id: verifiedProductId,
      artisan_id: req.session.user.id,
      title,
      description,
      images,
      starting_bid: parseFloat(starting_bid),
      starting_price: parseFloat(starting_bid),
      reserve_price: reserve_price ? parseFloat(reserve_price) : null,
      bid_increment: parseFloat(bid_increment) || 1,
      start_time,
      end_time
    });

    req.flash('success_msg', 'Auction created successfully!');
    res.redirect(`/auctions/${newAuction.id}`);
  } catch (err) {
    console.error('Create auction error:', err);
    req.flash('error_msg', 'Error creating auction');
    res.redirect('/artisan/auctions/new');
  }
};

exports.cancelAuction = (req, res) => {
  try {
    const { id } = req.params;
    const auction = Auction.findById(id);

    if (!auction || auction.artisan_id !== req.session.user.id) {
      req.flash('error_msg', 'Auction not found');
      return res.redirect('/artisan/auctions');
    }

    if (auction.status !== 'pending' && auction.status !== 'active') {
      req.flash('error_msg', 'Cannot cancel this auction');
      return res.redirect('/artisan/auctions');
    }

    Auction.cancel(id);
    req.flash('success_msg', 'Auction cancelled');
    res.redirect('/artisan/auctions');
  } catch (err) {
    console.error('Cancel auction error:', err);
    res.redirect('/artisan/auctions');
  }
};

exports.reviews = (req, res) => {
  try {
    const reviews = Review.findAll({ artisan_id: req.session.user.id });

    res.render('artisan/reviews', {
      title: 'Reviews - Craftify',
      reviews
    });
  } catch (err) {
    console.error('Artisan reviews error:', err);
    res.redirect('/artisan/dashboard');
  }
};

exports.coupons = (req, res) => {
  try {
    const artisanId = req.session.user.id;
    const coupons = Coupon.findAll({ artisan_id: artisanId });

    res.render('artisan/coupons', {
      title: 'Promo Codes - Craftify',
      coupons
    });
  } catch (err) {
    console.error('Artisan coupons error:', err);
    req.flash('error_msg', 'Unable to load promo codes');
    res.redirect('/artisan/dashboard');
  }
};

exports.createCoupon = (req, res) => {
  try {
    const artisanId = req.session.user.id;
    const {
      code,
      description,
      discount_type,
      discount_value,
      min_purchase,
      max_discount,
      valid_from,
      valid_until,
      usage_limit
    } = req.body;

    const parsedDiscountValue = Number.parseFloat(discount_value);
    const parsedMinPurchase = min_purchase ? Number.parseFloat(min_purchase) : 0;
    const parsedMaxDiscount = max_discount ? Number.parseFloat(max_discount) : null;
    const parsedUsageLimit = usage_limit ? Number.parseInt(usage_limit, 10) : null;

    // FIX: BUG 1 — reject if expiry date is in the past (server-side validation).
    if (valid_until && new Date(valid_until) <= new Date()) {
      req.flash('error_msg', 'Coupon expiry date must be in the future');
      return res.redirect('/artisan/coupons');
    }

    if (!code || !discount_type || !Number.isFinite(parsedDiscountValue) || parsedDiscountValue <= 0) {
      req.flash('error_msg', 'Invalid promo code data');
      return res.redirect('/artisan/coupons');
    }

    if (!Number.isFinite(parsedMinPurchase) || parsedMinPurchase < 0) {
      req.flash('error_msg', 'Invalid minimum purchase amount');
      return res.redirect('/artisan/coupons');
    }

    if (parsedMaxDiscount !== null && (!Number.isFinite(parsedMaxDiscount) || parsedMaxDiscount <= 0)) {
      req.flash('error_msg', 'Invalid maximum discount amount');
      return res.redirect('/artisan/coupons');
    }

    if (parsedUsageLimit !== null && (!Number.isInteger(parsedUsageLimit) || parsedUsageLimit <= 0)) {
      req.flash('error_msg', 'Invalid usage limit');
      return res.redirect('/artisan/coupons');
    }

    Coupon.create({
      code,
      description,
      discount_type,
      discount_value: parsedDiscountValue,
      min_purchase: parsedMinPurchase,
      max_discount: parsedMaxDiscount,
      valid_from: valid_from || null,
      valid_until: valid_until || null,
      usage_limit: parsedUsageLimit,
      scope: 'artisan',
      artisan_id: artisanId,
      created_by: artisanId
    });

    req.flash('success_msg', 'Promo code created');
    return res.redirect('/artisan/coupons');
  } catch (err) {
    console.error('Artisan create coupon error:', err);
    req.flash('error_msg', 'Unable to create promo code. Code may already exist.');
    return res.redirect('/artisan/coupons');
  }
};

exports.toggleCoupon = (req, res) => {
  try {
    const artisanId = req.session.user.id;
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      req.flash('error_msg', 'Invalid promo code');
      return res.redirect('/artisan/coupons');
    }

    const coupon = Coupon.findById(id);
    if (!coupon || Number.parseInt(coupon.artisan_id, 10) !== Number.parseInt(artisanId, 10)) {
      req.flash('error_msg', 'Promo code not found');
      return res.redirect('/artisan/coupons');
    }

    Coupon.toggleActive(id);
    req.flash('success_msg', 'Promo code status updated');
    return res.redirect('/artisan/coupons');
  } catch (err) {
    console.error('Artisan toggle coupon error:', err);
    req.flash('error_msg', 'Unable to update promo code');
    return res.redirect('/artisan/coupons');
  }
};

exports.deleteCoupon = (req, res) => {
  try {
    const artisanId = req.session.user.id;
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      req.flash('error_msg', 'Invalid promo code');
      return res.redirect('/artisan/coupons');
    }

    const coupon = Coupon.findById(id);
    if (!coupon || Number.parseInt(coupon.artisan_id, 10) !== Number.parseInt(artisanId, 10)) {
      req.flash('error_msg', 'Promo code not found');
      return res.redirect('/artisan/coupons');
    }

    Coupon.delete(id);
    req.flash('success_msg', 'Promo code deleted');
    return res.redirect('/artisan/coupons');
  } catch (err) {
    console.error('Artisan delete coupon error:', err);
    req.flash('error_msg', 'Unable to delete promo code');
    return res.redirect('/artisan/coupons');
  }
};

exports.analytics = (req, res) => {
  try {
    const artisanId = req.session.user.id;
    const stats = ArtisanProfile.getStats(artisanId);
    const monthlyRevenue = Order.getMonthlyRevenueByArtisan(artisanId, 6);
    const topProducts = Order.getTopProductsByArtisan(artisanId, 5);

    res.render('artisan/analytics', {
      title: 'Analytics - Craftify',
      stats,
      monthlyRevenue,
      topProducts
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.redirect('/artisan/dashboard');
  }
};
