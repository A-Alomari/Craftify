const User = require('../models/User');
const ArtisanProfile = require('../models/ArtisanProfile');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const Review = require('../models/Review');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');

function getReportWindowStartIso(period) {
  const now = new Date();

  switch (period) {
    case 'week':
      now.setDate(now.getDate() - 7);
      break;
    case 'year':
      now.setDate(now.getDate() - 365);
      break;
    case 'month':
    default:
      now.setDate(now.getDate() - 30);
      break;
  }

  return now.toISOString();
}

function respondAdminNotFound(req, res, redirectPath, message) {
  if (req.xhr) {
    return res.status(404).json({ success: false, message });
  }
  req.flash('error_msg', message);
  return res.redirect(redirectPath);
}

// Dashboard
exports.dashboard = (req, res) => {
  try {
    const userStats = User.getStats();
    const productStats = Product.getStats();
    const orderStats = Order.getStats();
    const auctionStats = Auction.getStats();

    // Recent activity
    const recentOrders = Order.findAll({ limit: 5 });
    const pendingArtisans = ArtisanProfile.findAll({ approved: false, limit: 5 });
    const pendingProducts = Product.findAll({ status: 'pending', limit: 5 });

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - Craftify',
      userStats,
      productStats,
      orderStats,
      auctionStats,
      recentOrders,
      pendingArtisans,
      pendingProducts
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
};

// Users management
exports.users = (req, res) => {
  try {
    const { role, status, search, page = 1 } = req.query;
    const limit = 10;
    const offset = (page - 1) * limit;

    const filters = {};
    if (role) filters.role = role;
    if (status) filters.status = status;
    if (search) filters.search = search;
    filters.limit = limit;
    filters.offset = offset;

    const users = User.findAll(filters);
    const totalUsers = User.count({ role: filters.role, status: filters.status });
    const totalPages = Math.ceil(totalUsers / limit);

    res.render('admin/users', {
      title: 'User Management - Craftify',
      users,
      filters: { role, status, search },
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Admin users error:', err);
    res.redirect('/admin/dashboard');
  }
};

exports.updateUserStatus = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid user ID');
      return res.redirect('/admin/users');
    }
    const { status } = req.body;
    const allowedStatuses = new Set(['active', 'suspended']);
    if (!allowedStatuses.has(status)) {
      if (req.xhr) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      req.flash('error_msg', 'Invalid status');
      return res.redirect('/admin/users');
    }

    User.updateStatus(id, status);

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'User status updated');
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Update user status error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error updating status' });
    }
    res.redirect('/admin/users');
  }
};

exports.deleteUser = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid user ID');
      return res.redirect('/admin/users');
    }
    
    // Don't allow deleting self
    if (id === req.session.user.id) {
      if (req.xhr) {
        return res.status(400).json({ success: false, message: 'Cannot delete yourself' });
      }
      req.flash('error_msg', 'Cannot delete yourself');
      return res.redirect('/admin/users');
    }

    User.delete(id);

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'User deleted');
    res.redirect('/admin/users');
  } catch (err) {
    console.error('Delete user error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error deleting user' });
    }
    res.redirect('/admin/users');
  }
};

// Artisan management
exports.artisans = (req, res) => {
  try {
    const { approved, search } = req.query;
    const filters = {};
    
    if (approved !== undefined) {
      filters.approved = approved === 'true';
    }
    if (search) filters.search = search;

    const artisans = ArtisanProfile.findAll(filters);

    res.render('admin/artisans', {
      title: 'Artisan Management - Craftify',
      artisans,
      filters: { approved, search }
    });
  } catch (err) {
    console.error('Admin artisans error:', err);
    res.redirect('/admin/dashboard');
  }
};

exports.approveArtisan = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid artisan ID');
      return res.redirect('/admin/artisans');
    }
    ArtisanProfile.approve(id);

    // Notify artisan
    Notification.artisanApproved(id);

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Artisan approved');
    res.redirect('/admin/artisans');
  } catch (err) {
    console.error('Approve artisan error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error approving artisan' });
    }
    res.redirect('/admin/artisans');
  }
};

exports.rejectArtisan = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid artisan ID');
      return res.redirect('/admin/artisans');
    }
    ArtisanProfile.reject(id);

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Artisan rejected');
    res.redirect('/admin/artisans');
  } catch (err) {
    console.error('Reject artisan error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error rejecting artisan' });
    }
    res.redirect('/admin/artisans');
  }
};

// Products management
exports.products = (req, res) => {
  try {
    const { status, category, search, page } = req.query;
    const filters = {};
    const currentPage = Math.max(1, parseInt(page) || 1);
    const limit = 20;
    const offset = (currentPage - 1) * limit;
    
    if (status) filters.status = status;
    if (category) filters.category_id = parseInt(category);
    if (search) filters.search = search;
    filters.limit = limit;
    filters.offset = offset;

    const products = Product.findAll(filters);
    const totalCount = Product.count(filters);
    const totalPages = Math.ceil(totalCount / limit);
    const categories = Category.findAll();

    res.render('admin/products', {
      title: 'Product Management - Craftify',
      products,
      categories,
      filters: { status, category, search },
      pagination: {
        currentPage,
        totalPages,
        totalItems: totalCount
      }
    });
  } catch (err) {
    console.error('Admin products error:', err);
    res.redirect('/admin/dashboard');
  }
};

exports.approveProduct = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid product ID');
      return res.redirect('/admin/products');
    }
    const product = Product.findById(id);
    if (!product) {
      return respondAdminNotFound(req, res, '/admin/products', 'Product not found');
    }

    Product.update(id, { status: 'approved' });
    Notification.productApproved(product.artisan_id, product.name);

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Product approved');
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Approve product error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error approving product' });
    }
    res.redirect('/admin/products');
  }
};

exports.rejectProduct = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid product ID');
      return res.redirect('/admin/products');
    }
    const product = Product.findById(id);
    if (!product) {
      return respondAdminNotFound(req, res, '/admin/products', 'Product not found');
    }

    Product.update(id, { status: 'rejected' });
    Notification.productRejected(product.artisan_id, product.name);

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Product rejected');
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Reject product error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error rejecting product' });
    }
    res.redirect('/admin/products');
  }
};

exports.toggleFeatured = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid product ID');
      return res.redirect('/admin/products');
    }
    const product = Product.findById(id);
    if (!product) {
      return respondAdminNotFound(req, res, '/admin/products', 'Product not found');
    }

    Product.update(id, { featured: product.featured ? 0 : 1 });

    if (req.xhr) {
      return res.json({ success: true, featured: !product.featured });
    }

    res.redirect('/admin/products');
  } catch (err) {
    console.error('Toggle featured error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false });
    }
    res.redirect('/admin/products');
  }
};

// Categories management
exports.categories = (req, res) => {
  try {
    const categories = Category.findAll();

    res.render('admin/categories', {
      title: 'Category Management - Craftify',
      categories
    });
  } catch (err) {
    console.error('Admin categories error:', err);
    res.redirect('/admin/dashboard');
  }
};

exports.createCategory = (req, res) => {
  try {
    const { name, description } = req.body;
    let image = '';
    if (req.file) {
      image = `/uploads/${req.file.filename}`;
    }

    Category.create({ name, description, image });

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Category created');
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('Create category error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error creating category' });
    }
    req.flash('error_msg', 'Error creating category');
    res.redirect('/admin/categories');
  }
};

exports.updateCategory = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid category ID');
      return res.redirect('/admin/categories');
    }
    const { name, description } = req.body;
    const updates = { name, description };

    if (req.file) {
      updates.image = `/uploads/${req.file.filename}`;
    }

    Category.update(id, updates);

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Category updated');
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('Update category error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error updating category' });
    }
    res.redirect('/admin/categories');
  }
};

exports.deleteCategory = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid category ID');
      return res.redirect('/admin/categories');
    }
    Category.delete(id);

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Category deleted');
    res.redirect('/admin/categories');
  } catch (err) {
    console.error('Delete category error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error deleting category' });
    }
    res.redirect('/admin/categories');
  }
};

// Orders management
exports.orders = (req, res) => {
  try {
    const { status, payment_status, search, page = 1 } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (payment_status) filters.payment_status = payment_status;
    if (search) filters.search = search;

    const orders = Order.findAll(filters);

    res.render('admin/orders', {
      title: 'Order Management - Craftify',
      orders,
      filters: { status, payment_status, search }
    });
  } catch (err) {
    console.error('Admin orders error:', err);
    res.redirect('/admin/dashboard');
  }
};

exports.orderDetail = (req, res) => {
  try {
    const { id } = req.params;
    const order = Order.findById(id);

    if (!order) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/admin/orders');
    }

    const items = Order.getItems(id);
    items.forEach(item => {
      const images = JSON.parse(item.images || '[]');
      item.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('admin/order-detail', {
      title: `Order #${id} - Admin - Craftify`,
      order,
      items
    });
  } catch (err) {
    console.error('Admin order detail error:', err);
    res.redirect('/admin/orders');
  }
};

exports.updateOrderStatus = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid order ID');
      return res.redirect('/admin/orders');
    }
    const { status } = req.body;
    const allowedStatuses = new Set(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded']);
    if (!allowedStatuses.has(status)) {
      if (req.xhr) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      req.flash('error_msg', 'Invalid status');
      return res.redirect(`/admin/orders/${id}`);
    }

    const order = Order.updateStatus(id, status);
    if (!order) {
      return respondAdminNotFound(req, res, '/admin/orders', 'Order not found');
    }
    Notification.orderStatusChanged(order.user_id, id, status);

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Order status updated');
    res.redirect(`/admin/orders/${id}`);
  } catch (err) {
    console.error('Update order status error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false });
    }
    res.redirect('/admin/orders');
  }
};

// Auctions management
exports.auctions = (req, res) => {
  try {
    const { status } = req.query;
    const filters = {};
    if (status) filters.status = status;

    const auctions = Auction.findAll(filters);

    auctions.forEach(a => {
      const images = JSON.parse(a.product_images || '[]');
      a.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('admin/auctions', {
      title: 'Auction Management - Craftify',
      auctions,
      filters: { status }
    });
  } catch (err) {
    console.error('Admin auctions error:', err);
    res.redirect('/admin/dashboard');
  }
};

exports.cancelAuction = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid auction ID');
      return res.redirect('/admin/auctions');
    }
    const auction = Auction.cancel(id);
    if (!auction) {
      return respondAdminNotFound(req, res, '/admin/auctions', 'Auction not found');
    }

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Auction cancelled');
    res.redirect('/admin/auctions');
  } catch (err) {
    console.error('Cancel auction error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false });
    }
    res.redirect('/admin/auctions');
  }
};

// Reviews management
exports.reviews = (req, res) => {
  try {
    const { status } = req.query;
    const filters = {};
    if (status) filters.status = status;

    const reviews = Review.findAll(filters);

    res.render('admin/reviews', {
      title: 'Review Management - Craftify',
      reviews,
      filters: { status }
    });
  } catch (err) {
    console.error('Admin reviews error:', err);
    res.redirect('/admin/dashboard');
  }
};

exports.updateReviewStatus = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid review ID');
      return res.redirect('/admin/reviews');
    }
    const { status } = req.body;
    const allowedStatuses = new Set(['visible', 'approved', 'hidden', 'rejected']);
    if (!allowedStatuses.has(status)) {
      if (req.xhr) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }
      req.flash('error_msg', 'Invalid status');
      return res.redirect('/admin/reviews');
    }

    const updatedReview = Review.updateStatus(id, status);
    if (!updatedReview) {
      return respondAdminNotFound(req, res, '/admin/reviews', 'Review not found');
    }

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Review status updated');
    res.redirect('/admin/reviews');
  } catch (err) {
    console.error('Update review status error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false });
    }
    res.redirect('/admin/reviews');
  }
};

exports.approveReview = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid review ID');
      return res.redirect('/admin/reviews');
    }
    const updatedReview = Review.updateStatus(id, 'visible');
    if (!updatedReview) {
      return respondAdminNotFound(req, res, '/admin/reviews', 'Review not found');
    }

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Review approved');
    res.redirect('/admin/reviews');
  } catch (err) {
    console.error('Approve review error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false });
    }
    res.redirect('/admin/reviews');
  }
};

exports.deleteReview = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid review ID');
      return res.redirect('/admin/reviews');
    }
    const review = Review.findById(id);
    if (!review) {
      return respondAdminNotFound(req, res, '/admin/reviews', 'Review not found');
    }
    Review.delete(id);

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Review deleted');
    res.redirect('/admin/reviews');
  } catch (err) {
    console.error('Delete review error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false });
    }
    res.redirect('/admin/reviews');
  }
};

// Coupons management
exports.coupons = (req, res) => {
  try {
    const coupons = Coupon.findAll();
    const artisans = ArtisanProfile.findAll({ approved: true, status: 'active' });

    res.render('admin/coupons', {
      title: 'Coupon Management - Craftify',
      coupons,
      artisans
    });
  } catch (err) {
    console.error('Admin coupons error:', err);
    res.redirect('/admin/dashboard');
  }
};

exports.createCoupon = (req, res) => {
  try {
    const {
      code,
      description,
      discount_type,
      discount_value,
      min_purchase,
      max_discount,
      valid_from,
      valid_until,
      usage_limit,
      scope,
      artisan_id
    } = req.body;

    const parsedDiscountValue = Number.parseFloat(discount_value);
    const parsedMinPurchase = min_purchase ? Number.parseFloat(min_purchase) : 0;
    const parsedMaxDiscount = max_discount ? Number.parseFloat(max_discount) : null;
    const parsedUsageLimit = usage_limit ? Number.parseInt(usage_limit, 10) : null;
    const normalizedScope = scope === 'artisan' ? 'artisan' : 'global';
    const parsedArtisanId = artisan_id ? Number.parseInt(artisan_id, 10) : null;

    if (!code || !discount_type || !Number.isFinite(parsedDiscountValue) || parsedDiscountValue <= 0) {
      if (req.xhr) {
        return res.status(400).json({ success: false, message: 'Invalid coupon data' });
      }
      req.flash('error_msg', 'Invalid coupon data');
      return res.redirect('/admin/coupons');
    }

    if (!Number.isFinite(parsedMinPurchase) || parsedMinPurchase < 0) {
      if (req.xhr) {
        return res.status(400).json({ success: false, message: 'Invalid minimum purchase amount' });
      }
      req.flash('error_msg', 'Invalid minimum purchase amount');
      return res.redirect('/admin/coupons');
    }

    if (parsedMaxDiscount !== null && (!Number.isFinite(parsedMaxDiscount) || parsedMaxDiscount <= 0)) {
      if (req.xhr) {
        return res.status(400).json({ success: false, message: 'Invalid maximum discount amount' });
      }
      req.flash('error_msg', 'Invalid maximum discount amount');
      return res.redirect('/admin/coupons');
    }

    if (parsedUsageLimit !== null && (!Number.isInteger(parsedUsageLimit) || parsedUsageLimit <= 0)) {
      if (req.xhr) {
        return res.status(400).json({ success: false, message: 'Invalid usage limit' });
      }
      req.flash('error_msg', 'Invalid usage limit');
      return res.redirect('/admin/coupons');
    }

    if (normalizedScope === 'artisan' && (!Number.isInteger(parsedArtisanId) || parsedArtisanId <= 0)) {
      if (req.xhr) {
        return res.status(400).json({ success: false, message: 'Please select an artisan for artisan-scoped coupons' });
      }
      req.flash('error_msg', 'Please select an artisan for artisan-scoped coupons');
      return res.redirect('/admin/coupons');
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
      scope: normalizedScope,
      artisan_id: normalizedScope === 'artisan' ? parsedArtisanId : null,
      created_by: req.session.user.id
    });

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Coupon created');
    res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Create coupon error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error creating coupon' });
    }
    req.flash('error_msg', 'Error creating coupon');
    res.redirect('/admin/coupons');
  }
};

exports.toggleCoupon = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid coupon ID');
      return res.redirect('/admin/coupons');
    }
    const coupon = Coupon.toggleActive(id);
    if (!coupon) {
      return respondAdminNotFound(req, res, '/admin/coupons', 'Coupon not found');
    }

    if (req.xhr) {
      return res.json({ success: true, active: coupon.active });
    }

    res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Toggle coupon error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false });
    }
    res.redirect('/admin/coupons');
  }
};

exports.deleteCoupon = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid coupon ID');
      return res.redirect('/admin/coupons');
    }
    const coupon = Coupon.findById(id);
    if (!coupon) {
      return respondAdminNotFound(req, res, '/admin/coupons', 'Coupon not found');
    }
    Coupon.delete(id);

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Coupon deleted');
    res.redirect('/admin/coupons');
  } catch (err) {
    console.error('Delete coupon error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false });
    }
    res.redirect('/admin/coupons');
  }
};

// Reports
exports.reports = (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const startIso = getReportWindowStartIso(period);
    const salesData = Order.getSalesDataSince(startIso);
    const topProducts = Order.getTopProductsSince(startIso, 10);
    const topArtisans = Order.getTopArtisansSince(startIso, 10);
    const totalRevenue = Order.getTotalRevenueSince(startIso);
    const totalOrders = Order.countSince(startIso);

    res.render('admin/reports', {
      title: 'Reports - Craftify',
      period,
      salesData,
      topProducts,
      topArtisans,
      totalRevenue,
      totalOrders
    });
  } catch (err) {
    console.error('Reports error:', err);
    res.redirect('/admin/dashboard');
  }
};

// Settings
exports.settings = (req, res) => {
  res.render('admin/settings', {
    title: 'Settings - Craftify'
  });
};
