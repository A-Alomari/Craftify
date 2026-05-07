const User = require('../models/User');
const ArtisanProfile = require('../models/ArtisanProfile');
const Product = require('../models/Product');
const Category = require('../models/Category');
const Order = require('../models/Order');
const Auction = require('../models/Auction');
const Review = require('../models/Review');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const SiteSetting = require('../models/SiteSetting');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcryptjs');
const NewsletterSubscription = require('../models/NewsletterSubscription');

function getReportWindowStartIso(period) {
  // Anchor to latest order date in DB so seeded data always shows
  const latestRow = Order.getLatestOrderDate();
  const anchor = latestRow ? new Date(latestRow) : new Date();
  switch (period) {
    case 'week':  anchor.setDate(anchor.getDate() - 7);   break;
    case 'year':  anchor.setDate(anchor.getDate() - 365);  break;
    case 'month':
    default:      anchor.setDate(anchor.getDate() - 30);   break;
  }
  return anchor.toISOString();
}

function getPrevReportWindowStartIso(period) {
  const latestRow = Order.getLatestOrderDate();
  const anchor = latestRow ? new Date(latestRow) : new Date();
  switch (period) {
    case 'week':  anchor.setDate(anchor.getDate() - 14);   break;
    case 'year':  anchor.setDate(anchor.getDate() - 730);  break;
    case 'month':
    default:      anchor.setDate(anchor.getDate() - 60);   break;
  }
  return anchor.toISOString();
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

    // Growth trajectory — last 30 active days (anchored to latest order in DB)
    const growthData = Order.getDashboardGrowthData();

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - Craftify',
      userStats,
      productStats,
      orderStats,
      auctionStats,
      recentOrders,
      pendingArtisans,
      pendingProducts,
      growthData
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
    AuditLog.record(req.session.user.id, req.session.user.name, 'delete_user', 'user', id, null, req.ip);

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
    const { approved, search, page } = req.query;
    const filters = {};
    const currentPage = Math.max(1, parseInt(page) || 1);
    const limit = 20;
    const offset = (currentPage - 1) * limit;

    if (approved !== undefined) {
      filters.approved = approved === 'true';
    }
    if (search) filters.search = search;

    const countFilters = { ...filters };
    filters.limit = limit;
    filters.offset = offset;

    const artisans = ArtisanProfile.findAll(filters);
    const totalCount = ArtisanProfile.count(countFilters);
    const totalPages = Math.ceil(totalCount / limit);

    res.render('admin/artisans', {
      title: 'Artisan Management - Craftify',
      artisans,
      filters: { approved, search },
      pagination: {
        current: currentPage,
        total: totalPages,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages
      }
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
    Notification.artisanApproved(id);
    AuditLog.record(req.session.user.id, req.session.user.name, 'approve_artisan', 'artisan', id, null, req.ip);

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
    AuditLog.record(req.session.user.id, req.session.user.name, 'reject_artisan', 'artisan', id, null, req.ip);

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
        current: currentPage,
        total: totalPages,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages
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
    AuditLog.record(req.session.user.id, req.session.user.name, 'approve_product', 'product', id, { name: product.name }, req.ip);

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
    AuditLog.record(req.session.user.id, req.session.user.name, 'reject_product', 'product', id, { name: product.name }, req.ip);

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

exports.productDetail = (req, res) => {
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
    let images = [];
    try { images = JSON.parse(product.images || '[]'); } catch (e) {}

    res.render('admin/product-detail', {
      title: `Product: ${product.name} - Admin - Craftify`,
      product,
      images
    });
  } catch (err) {
    console.error('Admin product detail error:', err);
    res.redirect('/admin/products');
  }
};

exports.deleteProduct = (req, res) => {
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
    Product.delete(id);
    AuditLog.record(req.session.user.id, req.session.user.name, 'delete_product', 'product', id, { name: product.name }, req.ip);

    if (req.xhr) {
      return res.json({ success: true });
    }

    req.flash('success_msg', 'Product deleted');
    res.redirect('/admin/products');
  } catch (err) {
    console.error('Delete product error:', err);
    if (req.xhr) {
      return res.status(500).json({ success: false, message: 'Error deleting product' });
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
    const { status, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 15;
    const offset = (page - 1) * limit;

    const filters = {};
    if (status) filters.status = status;
    if (search) filters.search = search;

    const orders = Order.findAll({ ...filters, limit, offset });
    const total = Order.countAll(filters);
    const stats = Order.getStatusCounts();

    // Attach first artisan name + avatar + product image to each order row
    const orderIds = orders.map(o => o.id);
    const previews = Order.getPreviewItemsForOrders(orderIds, 1);
    orders.forEach(o => {
      const preview = previews[o.id];
      const first = preview && preview[0] ? preview[0] : null;
      o.artisan_name   = first ? first.artisan_name   : '';
      o.artisan_avatar = first ? first.artisan_avatar : '';
      o.order_image    = first ? first.image          : '';
    });

    res.render('admin/orders', {
      title: 'Order Management - Craftify',
      orders,
      filters: { status: status || '', search: search || '' },
      stats,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total,
        limit
      }
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
    AuditLog.record(req.session.user.id, req.session.user.name, 'update_order_status', 'order', id, { status }, req.ip);

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
      const images = JSON.parse(a.product_images || a.images || '[]');
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

exports.auctionDetail = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid auction ID');
      return res.redirect('/admin/auctions');
    }
    const auction = Auction.findById(id);
    if (!auction) {
      return respondAdminNotFound(req, res, '/admin/auctions', 'Auction not found');
    }
    let images = [];
    try { images = JSON.parse(auction.product_images || auction.images || '[]'); } catch (e) {}

    res.render('admin/auction-detail', {
      title: `Auction: ${auction.product_name || auction.title} - Admin - Craftify`,
      auction,
      images
    });
  } catch (err) {
    console.error('Admin auction detail error:', err);
    res.redirect('/admin/auctions');
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

exports.approveAuction = (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id <= 0) {
      req.flash('error_msg', 'Invalid auction ID');
      return res.redirect('/admin/auctions');
    }
    const auction = Auction.approve(id);
    if (!auction) {
      return respondAdminNotFound(req, res, '/admin/auctions', 'Auction not found');
    }
    AuditLog.record(req.session.user.id, req.session.user.name, 'approve_auction', 'auction', id, null, req.ip);
    req.flash('success_msg', 'Auction approved and is now live');
    res.redirect('/admin/auctions');
  } catch (err) {
    console.error('Approve auction error:', err);
    res.redirect('/admin/auctions');
  }
};

exports.rejectAuction = (req, res) => {
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
    req.flash('success_msg', 'Auction rejected');
    res.redirect('/admin/auctions');
  } catch (err) {
    console.error('Reject auction error:', err);
    res.redirect('/admin/auctions');
  }
};

// Reviews management
exports.reviews = (req, res) => {
  try {
    const { status, rating, search, page } = req.query;
    const currentPage = Math.max(1, parseInt(page) || 1);
    const limit = 15;
    const offset = (currentPage - 1) * limit;

    const filters = {};
    if (status) filters.status = status;
    if (rating) filters.rating = parseInt(rating, 10);
    if (search) filters.search = search;

    const pagedFilters = { ...filters, limit, offset };
    const reviews = Review.findAll(pagedFilters);

    // Parse product image for each review row
    reviews.forEach(r => {
      try {
        const imgs = JSON.parse(r.product_images || '[]');
        r.product_image = imgs[0] || '';
      } catch (e) {
        r.product_image = '';
      }
    });

    // Compute total count with current filters for pagination
    const totalCount = Review.count(filters);
    const totalPages = Math.ceil(totalCount / limit);

    // Compute summary stats from all reviews (no filter)
    const allReviews = Review.findAll({});
    const totalReviews = allReviews.length;
    const pendingReviews = allReviews.filter(r => !r.is_approved).length;
    const avgRating = allReviews.length > 0
      ? (allReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / allReviews.length).toFixed(1)
      : '0.0';

    res.render('admin/reviews', {
      title: 'Review Management - Craftify',
      reviews,
      filters: { status, rating, search },
      pagination: {
        current: currentPage,
        total: totalPages,
        hasPrev: currentPage > 1,
        hasNext: currentPage < totalPages
      },
      reviewStats: { total: totalReviews, pending: pendingReviews, avgRating }
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

    const parseCouponDateInput = (rawValue, isEndOfDay = false) => {
      if (!rawValue) return { value: null };
      const value = String(rawValue).trim();
      const ddmmyyyyMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

      if (ddmmyyyyMatch) {
        const day = Number.parseInt(ddmmyyyyMatch[1], 10);
        const month = Number.parseInt(ddmmyyyyMatch[2], 10);
        const year = Number.parseInt(ddmmyyyyMatch[3], 10);
        const date = new Date(year, month - 1, day);

        if (
          date.getFullYear() !== year
          || date.getMonth() !== month - 1
          || date.getDate() !== day
        ) {
          return { error: 'Invalid date. Use DD/MM/YYYY.' };
        }

        const hh = isEndOfDay ? '23' : '00';
        const mm = isEndOfDay ? '59' : '00';
        const ss = isEndOfDay ? '59' : '00';
        const normalized = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${hh}:${mm}:${ss}`;
        return { value: normalized };
      }

      return { error: 'Invalid date. Use DD/MM/YYYY.' };
    };

    const parsedValidFrom = parseCouponDateInput(valid_from, false);
    const parsedValidUntil = parseCouponDateInput(valid_until, true);

    if (parsedValidFrom.error || parsedValidUntil.error) {
      const msg = parsedValidFrom.error || parsedValidUntil.error;
      if (req.xhr) {
        return res.status(400).json({ success: false, message: msg });
      }
      req.flash('error_msg', msg);
      return res.redirect('/admin/coupons');
    }

    const parsedDiscountValue = Number.parseFloat(discount_value);
    const parsedMinPurchase = min_purchase ? Number.parseFloat(min_purchase) : 0;
    const parsedMaxDiscount = max_discount ? Number.parseFloat(max_discount) : null;
    const parsedUsageLimit = usage_limit ? Number.parseInt(usage_limit, 10) : null;
    const normalizedScope = scope === 'artisan' ? 'artisan' : 'global';
    const parsedArtisanId = artisan_id ? Number.parseInt(artisan_id, 10) : null;

    // FIX: BUG 1 — reject if expiry date is in the past (server-side validation).
    if (parsedValidUntil.value && new Date(parsedValidUntil.value) <= new Date()) {
      if (req.xhr) {
        return res.status(400).json({ success: false, message: 'Coupon expiry date must be in the future' });
      }
      req.flash('error_msg', 'Coupon expiry date must be in the future');
      return res.redirect('/admin/coupons');
    }

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
      valid_from: parsedValidFrom.value,
      valid_until: parsedValidUntil.value,
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
    const startIso     = getReportWindowStartIso(period);
    const prevStartIso  = getPrevReportWindowStartIso(period);
    const salesData     = Order.getSalesDataSince(startIso);
    const topProducts   = Order.getTopProductsSince(startIso, 10);
    const topArtisans   = Order.getTopArtisansSince(startIso, 10);
    const totalRevenue  = Order.getTotalRevenueSince(startIso);
    const prevRevenue   = Order.getTotalRevenueSince(prevStartIso);
    const totalOrders   = Order.countSince(startIso);
    const statusCounts  = Order.getStatusCounts();

    // Commission growth vs previous period
    const commissionRate = parseFloat(SiteSetting.get('commission_rate') || '10') / 100;
    const curCommission  = Number(totalRevenue || 0) * commissionRate;
    const prevCommission = Number(prevRevenue  || 0) * commissionRate;
    const commissionGrowth = prevCommission > 0
      ? Math.round(((curCommission - prevCommission) / prevCommission) * 100)
      : null;

    res.render('admin/reports', {
      title: 'Reports - Craftify',
      period,
      salesData,
      topProducts,
      topArtisans,
      totalRevenue,
      totalOrders,
      statusCounts,
      commissionGrowth
    });
  } catch (err) {
    console.error('Reports error:', err);
    res.redirect('/admin/dashboard');
  }
};

// Settings — GET
exports.settings = (req, res) => {
  try {
    const settings = SiteSetting.getAll();
    const subscribers = NewsletterSubscription.findAll();
    const newsletterCount = subscribers.length;
    const auditLog = AuditLog.findRecent(5);
    res.render('admin/settings', {
      title: 'Platform Settings - Craftify',
      settings,
      subscribers,
      newsletterCount,
      auditLog
    });
  } catch (err) {
    console.error('Admin settings error:', err);
    req.flash('error_msg', 'Error loading settings');
    res.redirect('/admin/dashboard');
  }
};

// Settings — POST (save platform settings)
exports.updateSettings = (req, res) => {
  try {
    const {
      display_timezone,
      commission_rate,
      tax_rate,
      default_shipping_cost,
      free_shipping_threshold,
      max_auction_days,
      auction_listing_fee,
      email_sender_name,
      email_sender_address
    } = req.body;

    const commissionNum = parseFloat(commission_rate);
    if (isNaN(commissionNum) || commissionNum < 0 || commissionNum > 100) {
      req.flash('error_msg', 'Commission rate must be between 0 and 100');
      return res.redirect('/admin/settings');
    }
    const taxNum = parseFloat(tax_rate);
    if (isNaN(taxNum) || taxNum < 0 || taxNum > 100) {
      req.flash('error_msg', 'Tax rate must be between 0 and 100');
      return res.redirect('/admin/settings');
    }
    const shipCostNum = parseFloat(default_shipping_cost);
    if (isNaN(shipCostNum) || shipCostNum < 0) {
      req.flash('error_msg', 'Default shipping cost must be 0 or greater');
      return res.redirect('/admin/settings');
    }
    const freeShipNum = parseFloat(free_shipping_threshold);
    if (isNaN(freeShipNum) || freeShipNum < 0) {
      req.flash('error_msg', 'Free shipping threshold must be 0 or greater');
      return res.redirect('/admin/settings');
    }
    const maxDaysNum = parseInt(max_auction_days, 10);
    if (isNaN(maxDaysNum) || maxDaysNum < 1 || maxDaysNum > 365) {
      req.flash('error_msg', 'Max auction duration must be between 1 and 365 days');
      return res.redirect('/admin/settings');
    }
    const listingFeeNum = parseFloat(auction_listing_fee);
    if (isNaN(listingFeeNum) || listingFeeNum < 0) {
      req.flash('error_msg', 'Auction listing fee must be 0 or greater');
      return res.redirect('/admin/settings');
    }
    if (!email_sender_name || String(email_sender_name).trim().length < 2) {
      req.flash('error_msg', 'Sender name is required');
      return res.redirect('/admin/settings');
    }
    if (!email_sender_address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email_sender_address)) {
      req.flash('error_msg', 'A valid sender email address is required');
      return res.redirect('/admin/settings');
    }

    const allowedTimezones = new Set([
      'Asia/Bahrain', 'Asia/Riyadh', 'Asia/Dubai', 'UTC',
      'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles'
    ]);
    if (display_timezone && !allowedTimezones.has(display_timezone)) {
      req.flash('error_msg', 'Invalid timezone selection');
      return res.redirect('/admin/settings');
    }

    // supported_currencies comes as array from checkboxes (or single string)
    const rawCurrencies = req.body.supported_currencies;
    const allowedCurrencies = new Set(['BHD', 'SAR', 'AED', 'USD', 'EUR', 'GBP', 'KWD']);
    let currenciesArr = [];
    if (Array.isArray(rawCurrencies)) {
      currenciesArr = rawCurrencies.filter(c => allowedCurrencies.has(c));
    } else if (rawCurrencies && allowedCurrencies.has(rawCurrencies)) {
      currenciesArr = [rawCurrencies];
    }
    if (currenciesArr.length === 0) currenciesArr = ['BHD'];

    SiteSetting.bulkSet({
      display_timezone:        display_timezone || 'Asia/Bahrain',
      commission_rate:         String(commissionNum),
      tax_rate:                String(taxNum),
      default_shipping_cost:   String(shipCostNum),
      free_shipping_threshold: String(freeShipNum),
      supported_currencies:    currenciesArr.join(','),
      max_auction_days:        String(maxDaysNum),
      auction_listing_fee:     String(listingFeeNum),
      email_sender_name:       String(email_sender_name).trim(),
      email_sender_address:    String(email_sender_address).trim().toLowerCase()
    });

    AuditLog.record(req.session.user.id, req.session.user.name, 'update_settings', 'platform', null, null, req.ip);

    req.flash('success_msg', 'Platform settings saved successfully');
    res.redirect('/admin/settings');
  } catch (err) {
    console.error('Update settings error:', err);
    req.flash('error_msg', 'Error saving settings');
    res.redirect('/admin/settings');
  }
};

// Settings — POST change admin password
exports.changeAdminPassword = async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password || !confirm_password) {
      req.flash('error_msg', 'All password fields are required');
      return res.redirect('/admin/settings#security');
    }
    if (new_password !== confirm_password) {
      req.flash('error_msg', 'New passwords do not match');
      return res.redirect('/admin/settings#security');
    }
    if (new_password.length < 8) {
      req.flash('error_msg', 'New password must be at least 8 characters');
      return res.redirect('/admin/settings#security');
    }

    const admin = User.findById(req.session.user.id);
    if (!admin) {
      req.flash('error_msg', 'Admin account not found');
      return res.redirect('/admin/settings#security');
    }

    const match = bcrypt.compareSync(current_password, admin.password);
    if (!match) {
      req.flash('error_msg', 'Current password is incorrect');
      return res.redirect('/admin/settings#security');
    }

    await User.updatePassword(admin.id, new_password);
    AuditLog.record(req.session.user.id, req.session.user.name, 'change_password', 'user', admin.id, null, req.ip);

    req.flash('success_msg', 'Password changed successfully');
    res.redirect('/admin/settings#security');
  } catch (err) {
    console.error('Change admin password error:', err);
    req.flash('error_msg', 'Error changing password');
    res.redirect('/admin/settings#security');
  }
};

// Newsletter CSV export
exports.newsletterExport = (req, res) => {
  try {
    const subscribers = NewsletterSubscription.findAll();
    const csv = ['email,joined_at', ...subscribers.map(s => `${s.email},${s.created_at}`)].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="craftify-subscribers.csv"');
    res.send(csv);
  } catch (err) {
    console.error('Newsletter export error:', err);
    req.flash('error_msg', 'Error exporting subscribers');
    res.redirect('/admin/settings');
  }
};

// Full audit log page
exports.auditLog = (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = 30;
    const offset = (page - 1) * limit;
    const logs = AuditLog.findAll({ limit, offset });
    const total = AuditLog.count();
    res.render('admin/audit-log', {
      title: 'Activity Ledger - Craftify',
      logs,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total,
        limit
      }
    });
  } catch (err) {
    console.error('Audit log error:', err);
    res.redirect('/admin/settings');
  }
};
