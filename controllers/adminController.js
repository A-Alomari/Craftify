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
const PDFDocument = require('pdfkit');
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

// ─── Report Export ───────────────────────────────────────────────────────────
// Types: sales | artisan | orders | platform | custom
// Framework maps to Chapter 11 (Designing Forms and Reports):
//   sales    = Scheduled    — routine periodic revenue summary
//   artisan  = Drill-Down   — detailed artisan performance records
//   orders   = Key-Indicator — critical order KPIs & fulfilment rates
//   platform = Exception    — platform-wide health flags & user/product stats
//   custom   = Ad-Hoc       — user-specified date range, full cross-section
exports.exportReport = (req, res) => {
  try {
    const { type = 'sales', from, to, format = 'pdf', period = 'month' } = req.query;

    let startIso, endIso;
    if (from && to) {
      startIso = new Date(from).toISOString();
      endIso   = new Date(to + 'T23:59:59').toISOString();
    } else {
      startIso = getReportWindowStartIso(period);
      endIso   = new Date().toISOString();
    }

    let periodLabel;
    if (from && to) {
      periodLabel = `${from} to ${to}`;
    } else {
      periodLabel = period === 'week' ? 'Last 7 Days' : period === 'year' ? 'Last 365 Days' : 'Last 30 Days';
    }

    const generatedAt = new Date().toLocaleString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const commissionRate = parseFloat(SiteSetting.get('commission_rate') || '10') / 100;

    const salesData    = Order.getSalesDataSince(startIso);
    const totalRevenue = Number(Order.getTotalRevenueSince(startIso) || 0);
    const totalOrders  = Number(Order.countSince(startIso) || 0);
    const commission   = totalRevenue * commissionRate;
    const statusCounts = Order.getStatusCounts() || {};
    const userStats    = User.getStats();
    const productStats = Product.getStats();
    const topArtisans  = Order.getTopArtisansSince(startIso, 20);
    const recentOrders = Order.findAll({ limit: 100 });

    const prevStartIso     = getPrevReportWindowStartIso(period);
    const prevRevenue      = Number(Order.getTotalRevenueSince(prevStartIso) || 0);
    const prevOrders       = Number(Order.countSince(prevStartIso) || 0);
    const revenueGrowth    = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : null;
    const ordersGrowth     = prevOrders  > 0 ? Math.round(((totalOrders  - prevOrders)  / prevOrders)  * 100) : null;
    const commissionGrowth = (prevRevenue * commissionRate) > 0
      ? Math.round(((commission - prevRevenue * commissionRate) / (prevRevenue * commissionRate)) * 100) : null;

    const cancellationRate = (statusCounts.total || 0) > 0
      ? Math.round(((statusCounts.cancelled || 0) / statusCounts.total) * 100) : 0;
    const avgDailyRevenue  = salesData.length > 0 ? totalRevenue / salesData.length : 0;
    const lowRevenueDays   = salesData.filter(function(d) { return Number(d.revenue) < avgDailyRevenue * 0.5; });
    const fulfillmentRate  = (statusCounts.total || 0) > 0
      ? Math.round(((statusCounts.delivered || 0) / statusCounts.total) * 100) : 0;

    const payload = {
      type, periodLabel, generatedAt, commissionRate,
      salesData, totalRevenue, totalOrders, commission,
      statusCounts, userStats, productStats,
      topArtisans, recentOrders,
      revenueGrowth, ordersGrowth, commissionGrowth,
      prevRevenue, prevOrders,
      cancellationRate, avgDailyRevenue, lowRevenueDays, fulfillmentRate
    };

    if (format === 'csv') return _exportCsv(res, payload);
    return _exportPdf(res, payload);

  } catch (err) {
    console.error('Report export error:', err);
    res.status(500).send('Error generating report');
  }
};

// ─── Colour palette ──────────────────────────────────────────────────────────
const C = {
  PRIMARY:  '#855300',
  DARK:     '#111827',
  GRAY:     '#6b7280',
  LIGHT_BG: '#f9fafb',
  WHITE:    '#ffffff',
  GREEN:    '#15803d',
  RED:      '#b91c1c',
  ORANGE:   '#b45309',
  PURPLE:   '#6d28d9',
  BLUE:     '#1d4ed8',
  BORDER:   '#d1d5db',
  RULE:     '#e5e7eb'
};

// ─── PDF primitives ──────────────────────────────────────────────────────────
function _pdfHeader(doc, W, reportLabel, periodLabel, generatedAt) {
  doc.rect(0, 0, doc.page.width, 5).fill(C.PRIMARY);
  doc.fillColor(C.DARK).font('Helvetica-Bold').fontSize(22).text('CRAFTIFY', 50, 22);
  doc.fillColor(C.GRAY).font('Helvetica').fontSize(9).text('Artisan Marketplace Platform', 50, 49);
  doc.fillColor(C.DARK).font('Helvetica-Bold').fontSize(15)
     .text(reportLabel, 50, 22, { width: W, align: 'right' });
  doc.fillColor(C.GRAY).font('Helvetica').fontSize(8.5)
     .text(`Period: ${periodLabel}`, 50, 43, { width: W, align: 'right' });
  doc.fillColor(C.GRAY).font('Helvetica').fontSize(8.5)
     .text(`Generated: ${generatedAt}  ·  Confidential`, 50, 55, { width: W, align: 'right' });
  doc.moveTo(50, 70).lineTo(50 + W, 70).strokeColor(C.PRIMARY).lineWidth(1.5).stroke();
  doc.moveTo(50, 73).lineTo(50 + W, 73).strokeColor(C.RULE).lineWidth(0.5).stroke();
}

function _pdfSectionTitle(doc, W, y, title) {
  y += 6;
  doc.rect(50, y, 3, 16).fill(C.PRIMARY);
  doc.fillColor(C.DARK).font('Helvetica-Bold').fontSize(11).text(title, 60, y + 2);
  doc.moveTo(50, y + 22).lineTo(50 + W, y + 22).strokeColor(C.RULE).lineWidth(0.5).stroke();
  return y + 32;
}

function _pdfTableHeader(doc, W, y, cols) {
  const TW = cols.reduce(function(s, c) { return s + c.w; }, 0);
  doc.rect(50, y, TW, 20).fill(C.DARK);
  doc.fillColor(C.WHITE).font('Helvetica-Bold').fontSize(8.5);
  let x = 50;
  cols.forEach(function(col) {
    doc.text(col.label, x + 6, y + 6, { width: col.w - 10, align: col.align || 'left' });
    x += col.w;
  });
  return y + 20;
}

function _pdfTableRow(doc, y, cols, values, i) {
  const TW = cols.reduce(function(s, c) { return s + c.w; }, 0);
  doc.rect(50, y, TW, 18).fill(i % 2 === 0 ? C.WHITE : C.LIGHT_BG);
  doc.moveTo(50, y + 18).lineTo(50 + TW, y + 18).strokeColor(C.RULE).lineWidth(0.5).stroke();
  if (i > 0 && i % 5 === 0)
    doc.moveTo(50, y).lineTo(50 + TW, y).strokeColor(C.BORDER).lineWidth(0.8).stroke();
  let x = 50;
  cols.forEach(function(col, ci) {
    const val   = values[ci];
    const color = (col.color && col.color(val)) || C.DARK;
    doc.fillColor(color).font(col.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
       .text(String(val != null ? val : '—'), x + 6, y + 5, { width: col.w - 10, align: col.align || 'left' });
    x += col.w;
  });
  return y + 18;
}

function _pdfTotalsRow(doc, y, cols, values) {
  const TW = cols.reduce(function(s, c) { return s + c.w; }, 0);
  doc.rect(50, y, TW, 20).fill(C.DARK);
  doc.fillColor(C.WHITE).font('Helvetica-Bold').fontSize(9);
  let x = 50;
  cols.forEach(function(col, ci) {
    doc.text(String(values[ci] != null ? values[ci] : ''), x + 6, y + 6, { width: col.w - 10, align: col.align || 'left' });
    x += col.w;
  });
  return y + 20;
}

function _pdfFooters(doc, W, reportLabel, periodLabel) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const pageY = doc.page.height - 32;
    doc.moveTo(50, pageY).lineTo(50 + W, pageY).strokeColor(C.BORDER).lineWidth(0.5).stroke();
    doc.fillColor(C.GRAY).font('Helvetica').fontSize(8)
       .text(`Craftify  ·  ${reportLabel}  ·  ${periodLabel}`, 50, pageY + 6, { width: W - 80 });
    doc.fillColor(C.PRIMARY).font('Helvetica-Bold').fontSize(8)
       .text(`Page ${i - range.start + 1} of ${range.count}`, 50, pageY + 6, { width: W, align: 'right' });
  }
}

// ─── PDF builder ─────────────────────────────────────────────────────────────
function _exportPdf(res, data) {
  const {
    type, periodLabel, generatedAt, commissionRate,
    salesData, totalRevenue, totalOrders, commission,
    statusCounts, userStats, productStats,
    topArtisans, recentOrders,
    revenueGrowth, ordersGrowth, commissionGrowth,
    prevRevenue, prevOrders,
    cancellationRate, avgDailyRevenue, lowRevenueDays, fulfillmentRate
  } = data;

  const LABELS = {
    sales:    'Sales & Revenue Report',
    artisan:  'Artisan Performance Report',
    orders:   'Order Analytics Report',
    platform: 'Platform Overview Report',
    custom:   'Custom Date Range Report'
  };
  const reportLabel = LABELS[type] || LABELS.sales;

  const doc = new PDFDocument({ margins: { top: 50, left: 50, right: 50, bottom: 0 }, size: 'A4', bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="craftify-${type}-report-${Date.now()}.pdf"`);
  doc.pipe(res);

  const W = doc.page.width - 100;
  _pdfHeader(doc, W, reportLabel, periodLabel, generatedAt);
  let y = 92;

  // Helper: draw a row of KPI boxes
  function kpiCards(cards, ncols) {
    ncols = ncols || 4;
    const gutter = 10;
    const cardW  = Math.floor((W - gutter * (ncols - 1)) / ncols);
    cards.forEach(function(card, i) {
      const col = i % ncols;
      const row = Math.floor(i / ncols);
      const cx  = 50 + col * (cardW + gutter);
      const cy  = y + row * 62;
      doc.roundedRect(cx, cy, cardW, 52, 3).fillAndStroke(C.WHITE, C.BORDER);
      doc.roundedRect(cx, cy + 44, cardW, 8, 3).fill(card.accent || C.PRIMARY);
      doc.fillColor(C.GRAY).font('Helvetica').fontSize(7.5)
         .text(card.label.toUpperCase(), cx + 8, cy + 8, { width: cardW - 16 });
      doc.fillColor(card.color || C.DARK).font('Helvetica-Bold').fontSize(14)
         .text(String(card.value), cx + 8, cy + 22, { width: cardW - 16 });
    });
    return y + Math.ceil(cards.length / ncols) * 62 + 8;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. SALES & REVENUE REPORT
  //    Shows: revenue summary, daily breakdown table, commission split
  // ══════════════════════════════════════════════════════════════════════════
  if (type === 'sales') {
    y = _pdfSectionTitle(doc, W, y, 'REVENUE SUMMARY');
    y = kpiCards([
      { label: 'Total Revenue',
        value: `$${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        accent: C.PRIMARY },
      { label: `Commission Earned (${Math.round(commissionRate * 100)}%)`,
        value: `$${commission.toFixed(2)}`,
        accent: C.ORANGE },
      { label: 'Net Artisan Payout',
        value: `$${(totalRevenue - commission).toFixed(2)}`,
        accent: C.BLUE },
      { label: 'Revenue vs Prev Period',
        value: revenueGrowth !== null ? `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}%` : 'N/A',
        color: revenueGrowth !== null ? (revenueGrowth >= 0 ? C.GREEN : C.RED) : C.GRAY,
        accent: revenueGrowth !== null ? (revenueGrowth >= 0 ? C.GREEN : C.RED) : C.GRAY }
    ], 4);

    y = kpiCards([
      { label: 'Total Orders',
        value: String(totalOrders),
        accent: C.DARK },
      { label: 'Avg Order Value',
        value: totalOrders > 0 ? `$${(totalRevenue / totalOrders).toFixed(2)}` : '—',
        accent: C.PRIMARY },
      { label: 'Prev Period Revenue',
        value: `$${prevRevenue.toFixed(2)}`,
        accent: C.GRAY },
      { label: 'Active Trading Days',
        value: String(salesData ? salesData.length : 0),
        accent: C.GREEN }
    ], 4);

    if (salesData && salesData.length > 0) {
      if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
      y = _pdfSectionTitle(doc, W, y, 'DAILY REVENUE BREAKDOWN');
      const cols = [
        { label: 'DATE',               w: 80 },
        { label: 'ORDERS',             w: 50,  align: 'right' },
        { label: 'GROSS REVENUE',      w: 90,  align: 'right', bold: true, color: function() { return C.PRIMARY; } },
        { label: `COMMISSION (${Math.round(commissionRate*100)}%)`, w: 85, align: 'right' },
        { label: 'ARTISAN PAYOUT',     w: 85,  align: 'right' },
        { label: '% OF TOTAL',         w: W - 390, align: 'right' }
      ];
      y = _pdfTableHeader(doc, W, y, cols);
      (salesData || []).forEach(function(row, i) {
        if (y > doc.page.height - 60) { doc.addPage(); y = 50; y = _pdfTableHeader(doc, W, y, cols); }
        const rev    = Number(row.revenue || 0);
        const comm   = rev * commissionRate;
        const payout = rev - comm;
        const pct    = totalRevenue > 0 ? (rev / totalRevenue * 100).toFixed(1) : '0.0';
        y = _pdfTableRow(doc, y, cols, [
          row.date, String(row.orders || 0),
          `$${rev.toFixed(2)}`, `$${comm.toFixed(2)}`, `$${payout.toFixed(2)}`, `${pct}%`
        ], i);
      });
      y = _pdfTotalsRow(doc, y, cols, [
        'TOTAL', String(totalOrders),
        `$${totalRevenue.toFixed(2)}`, `$${commission.toFixed(2)}`,
        `$${(totalRevenue - commission).toFixed(2)}`, '100%'
      ]);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. ARTISAN PERFORMANCE REPORT
  //    Shows: top artisans by revenue, commission contribution, ranking
  // ══════════════════════════════════════════════════════════════════════════
  else if (type === 'artisan') {
    const totalArtisanRev = (topArtisans || []).reduce(function(s, a) { return s + Number(a.revenue || 0); }, 0);

    y = _pdfSectionTitle(doc, W, y, 'ARTISAN PERFORMANCE SUMMARY');
    y = kpiCards([
      { label: 'Active Artisans (period)',
        value: String((topArtisans || []).length),
        accent: C.PRIMARY },
      { label: 'Total Artisan Revenue',
        value: `$${totalArtisanRev.toFixed(2)}`,
        accent: C.ORANGE },
      { label: 'Total Commission Collected',
        value: `$${(totalArtisanRev * commissionRate).toFixed(2)}`,
        accent: C.BLUE },
      { label: 'Avg Revenue / Artisan',
        value: (topArtisans || []).length > 0
          ? `$${(totalArtisanRev / topArtisans.length).toFixed(2)}` : '—',
        accent: C.GREEN }
    ], 4);

    if (topArtisans && topArtisans.length > 0) {
      if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
      y = _pdfSectionTitle(doc, W, y, `ARTISAN REVENUE RANKING  (${topArtisans.length} artisans)`);
      const cols = [
        { label: 'RANK',             w: 35 },
        { label: 'ARTISAN NAME',     w: W - 380 },
        { label: 'SHOP',             w: 90 },
        { label: 'GROSS REVENUE',    w: 80,  align: 'right', bold: true, color: function() { return C.PRIMARY; } },
        { label: 'COMMISSION',       w: 65,  align: 'right', color: function() { return C.ORANGE; } },
        { label: 'NET PAYOUT',       w: 65,  align: 'right' },
        { label: '% OF TOTAL',       w: 45,  align: 'right' }
      ];
      y = _pdfTableHeader(doc, W, y, cols);
      topArtisans.forEach(function(a, i) {
        if (y > doc.page.height - 60) { doc.addPage(); y = 50; y = _pdfTableHeader(doc, W, y, cols); }
        const rev    = Number(a.revenue || 0);
        const comm   = rev * commissionRate;
        const payout = rev - comm;
        const share  = totalArtisanRev > 0 ? (rev / totalArtisanRev * 100).toFixed(1) : '0.0';
        y = _pdfTableRow(doc, y, cols, [
          String(i + 1), a.name || '—', a.shop_name || '—',
          `$${rev.toFixed(2)}`, `$${comm.toFixed(2)}`, `$${payout.toFixed(2)}`, `${share}%`
        ], i);
      });
      y = _pdfTotalsRow(doc, y, cols, [
        '', 'TOTAL', '',
        `$${totalArtisanRev.toFixed(2)}`,
        `$${(totalArtisanRev * commissionRate).toFixed(2)}`,
        `$${(totalArtisanRev * (1 - commissionRate)).toFixed(2)}`,
        '100%'
      ]);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. ORDER ANALYTICS REPORT
  //    Shows: order KPIs, status breakdown, fulfillment rate, cancellations
  // ══════════════════════════════════════════════════════════════════════════
  else if (type === 'orders') {
    y = _pdfSectionTitle(doc, W, y, 'ORDER PERFORMANCE SUMMARY');
    y = kpiCards([
      { label: 'Total Orders',
        value: String(totalOrders),
        accent: C.PRIMARY },
      { label: 'Orders vs Prev Period',
        value: ordersGrowth !== null ? `${ordersGrowth >= 0 ? '+' : ''}${ordersGrowth}%` : 'N/A',
        color: ordersGrowth !== null ? (ordersGrowth >= 0 ? C.GREEN : C.RED) : C.GRAY,
        accent: ordersGrowth !== null ? (ordersGrowth >= 0 ? C.GREEN : C.RED) : C.GRAY },
      { label: 'Fulfillment Rate',
        value: `${fulfillmentRate}%`,
        color: fulfillmentRate >= 80 ? C.GREEN : C.RED,
        accent: fulfillmentRate >= 80 ? C.GREEN : C.RED },
      { label: 'Cancellation Rate',
        value: `${cancellationRate}%`,
        color: cancellationRate > 15 ? C.RED : C.DARK,
        accent: cancellationRate > 15 ? C.RED : C.GREEN }
    ], 4);

    y = kpiCards([
      { label: 'Avg Order Value',
        value: totalOrders > 0 ? `$${(totalRevenue / totalOrders).toFixed(2)}` : '—',
        accent: C.BLUE },
      { label: 'Orders Delivered',
        value: String(statusCounts.delivered || 0),
        accent: C.GREEN },
      { label: 'Orders Cancelled',
        value: String(statusCounts.cancelled || 0),
        color: (statusCounts.cancelled || 0) > 0 ? C.RED : C.DARK,
        accent: (statusCounts.cancelled || 0) > 0 ? C.RED : C.GREEN },
      { label: 'Orders In Progress',
        value: String((statusCounts.processing || 0) + (statusCounts.shipped || 0)),
        accent: C.ORANGE }
    ], 4);

    if (y > doc.page.height - 150) { doc.addPage(); y = 50; }
    y = _pdfSectionTitle(doc, W, y, 'ORDER STATUS BREAKDOWN');
    const stCols = [
      { label: 'STATUS',      w: 160 },
      { label: 'COUNT',       w: 100, align: 'right' },
      { label: 'PERCENTAGE',  w: 100, align: 'right' },
      { label: 'REVENUE',     w: 120, align: 'right' }
    ];
    stCols[stCols.length-1].w += W - stCols.reduce(function(s,c){return s+c.w;},0);
    y = _pdfTableHeader(doc, W, y, stCols);
    const scTotal = (statusCounts.total || 1);
    [
      { key: 'delivered',  label: 'Delivered',   color: C.GREEN  },
      { key: 'shipped',    label: 'Shipped',      color: C.PURPLE },
      { key: 'processing', label: 'Processing',   color: C.BLUE   },
      { key: 'cancelled',  label: 'Cancelled',    color: C.RED    },
      { key: 'pending',    label: 'Pending',      color: C.ORANGE }
    ].forEach(function(s, i) {
      const cnt = statusCounts[s.key] || 0;
      const pct = Math.round(cnt / scTotal * 100);
      const TW  = stCols.reduce(function(sum,c){return sum+c.w;},0);
      doc.rect(50, y, TW, 18).fill(i % 2 === 0 ? C.WHITE : C.LIGHT_BG);
      doc.moveTo(50, y+18).lineTo(50+TW, y+18).strokeColor(C.RULE).lineWidth(0.5).stroke();
      doc.fillColor(s.color).font('Helvetica-Bold').fontSize(9).text(s.label, 56, y+5, { width: stCols[0].w-10 });
      doc.fillColor(C.DARK).font('Helvetica').fontSize(9).text(String(cnt), 50+stCols[0].w+6, y+5, { width: stCols[1].w-10, align: 'right' });
      doc.fillColor(C.DARK).font('Helvetica').fontSize(9).text(`${pct}%`, 50+stCols[0].w+stCols[1].w+6, y+5, { width: stCols[2].w-10, align: 'right' });
      doc.fillColor(C.GRAY).font('Helvetica').fontSize(9).text('—', 50+stCols[0].w+stCols[1].w+stCols[2].w+6, y+5, { width: stCols[3].w-10, align: 'right' });
      y += 18;
    });
    y += 10;

    // Order history list
    if (recentOrders && recentOrders.length > 0) {
      if (y > doc.page.height - 150) { doc.addPage(); y = 50; }
      y = _pdfSectionTitle(doc, W, y, `ORDER REGISTER  (${recentOrders.length} most recent orders)`);
      const oCols = [
        { label: 'ORDER ID',  w: 70 },
        { label: 'CUSTOMER',  w: W - 345 },
        { label: 'DATE',      w: 80 },
        { label: 'STATUS',    w: 80, color: function(v) {
            if (v === 'Delivered') return C.GREEN;
            if (v === 'Cancelled') return C.RED;
            if (v === 'Shipped')   return C.PURPLE;
            return C.BLUE;
          }
        },
        { label: 'ITEMS',     w: 40, align: 'right' },
        { label: 'AMOUNT',    w: 75, align: 'right', bold: true, color: function() { return C.PRIMARY; } }
      ];
      y = _pdfTableHeader(doc, W, y, oCols);
      recentOrders.forEach(function(o, i) {
        if (y > doc.page.height - 60) { doc.addPage(); y = 50; y = _pdfTableHeader(doc, W, y, oCols); }
        const st = o.status || 'pending';
        y = _pdfTableRow(doc, y, oCols, [
          o.id ? String(o.id).slice(0, 13) : '—',
          o.customer_name || '—',
          o.created_at ? String(o.created_at).slice(0, 10) : '—',
          st.charAt(0).toUpperCase() + st.slice(1),
          String(o.item_count || 0),
          `$${Number(o.total_amount || 0).toFixed(2)}`
        ], i);
      });
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 4. PLATFORM OVERVIEW REPORT
  //    Shows: users, products, health flags, suspended/pending items
  // ══════════════════════════════════════════════════════════════════════════
  else if (type === 'platform') {
    y = _pdfSectionTitle(doc, W, y, 'PLATFORM USER STATISTICS');
    y = kpiCards([
      { label: 'Total Registered Users', value: String(userStats ? userStats.total || 0 : 0),    accent: C.PRIMARY },
      { label: 'Customer Accounts',      value: String(userStats ? userStats.customers || 0 : 0), accent: C.BLUE   },
      { label: 'Artisan Accounts',       value: String(userStats ? userStats.artisans || 0 : 0),  accent: C.ORANGE },
      { label: 'Suspended Accounts',
        value: String(userStats ? userStats.suspended || 0 : 0),
        color: (userStats && userStats.suspended) ? C.RED : C.DARK,
        accent: (userStats && userStats.suspended) ? C.RED : C.GREEN }
    ], 4);

    y = _pdfSectionTitle(doc, W, y, 'PRODUCT CATALOGUE STATISTICS');
    y = kpiCards([
      { label: 'Total Products Listed',  value: String(productStats ? productStats.total || 0 : 0),    accent: C.PRIMARY },
      { label: 'Approved & Active',      value: String(productStats ? productStats.approved || 0 : 0), accent: C.GREEN   },
      { label: 'Pending Approval',
        value: String(productStats ? productStats.pending || 0 : 0),
        color: (productStats && productStats.pending) ? C.RED : C.DARK,
        accent: (productStats && productStats.pending) ? C.RED : C.GREEN },
      { label: 'Rejected',               value: String(productStats ? productStats.rejected || 0 : 0), accent: C.GRAY   }
    ], 4);

    y = _pdfSectionTitle(doc, W, y, 'REVENUE & ORDER SNAPSHOT');
    y = kpiCards([
      { label: 'Total Platform Revenue', value: `$${totalRevenue.toFixed(2)}`,           accent: C.PRIMARY },
      { label: 'Commission Earned',      value: `$${commission.toFixed(2)}`,             accent: C.ORANGE  },
      { label: 'Total Orders',           value: String(totalOrders),                     accent: C.BLUE    },
      { label: 'Cancellation Rate',
        value: `${cancellationRate}%`,
        color: cancellationRate > 15 ? C.RED : C.DARK,
        accent: cancellationRate > 15 ? C.RED : C.GREEN }
    ], 4);

    // Alerts section
    const alerts = [];
    if ((productStats ? productStats.pending || 0 : 0) > 0)
      alerts.push({ msg: `${productStats.pending} product(s) are awaiting admin approval.`, sev: 'warn' });
    if ((userStats ? userStats.suspended || 0 : 0) > 0)
      alerts.push({ msg: `${userStats.suspended} user account(s) are currently suspended.`, sev: 'warn' });
    if (cancellationRate > 15)
      alerts.push({ msg: `Order cancellation rate (${cancellationRate}%) exceeds the 15% warning threshold.`, sev: 'critical' });
    if (lowRevenueDays && lowRevenueDays.length > 0)
      alerts.push({ msg: `${lowRevenueDays.length} trading day(s) had revenue below 50% of the period average ($${avgDailyRevenue.toFixed(2)}).`, sev: 'warn' });

    if (alerts.length > 0) {
      if (y > doc.page.height - 160) { doc.addPage(); y = 50; }
      y = _pdfSectionTitle(doc, W, y, `PLATFORM HEALTH ALERTS  (${alerts.length} item${alerts.length > 1 ? 's' : ''})`);
      alerts.forEach(function(a) {
        const bg    = a.sev === 'critical' ? '#fef2f2' : '#fffbeb';
        const color = a.sev === 'critical' ? C.RED : C.ORANGE;
        doc.roundedRect(50, y, W, 30, 3).fillAndStroke(bg, color);
        doc.fillColor(color).font('Helvetica-Bold').fontSize(9)
           .text(`\u26A0  ${a.msg}`, 62, y + 10, { width: W - 24 });
        y += 36;
      });
      y += 4;
    } else {
      if (y > doc.page.height - 80) { doc.addPage(); y = 50; }
      doc.roundedRect(50, y, W, 30, 3).fillAndStroke('#f0fdf4', C.GREEN);
      doc.fillColor(C.GREEN).font('Helvetica-Bold').fontSize(9)
         .text('\u2713  No platform exceptions detected. All systems operating within normal thresholds.', 62, y + 10, { width: W - 24 });
      y += 36;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 5. CUSTOM DATE RANGE REPORT
  //    Full cross-section for any user-specified period
  // ══════════════════════════════════════════════════════════════════════════
  else {
    y = _pdfSectionTitle(doc, W, y, 'SUMMARY FOR SELECTED PERIOD');
    y = kpiCards([
      { label: 'Total Revenue',        value: `$${totalRevenue.toFixed(2)}`,                                         accent: C.PRIMARY },
      { label: `Commission (${Math.round(commissionRate*100)}%)`, value: `$${commission.toFixed(2)}`,                accent: C.ORANGE  },
      { label: 'Net Artisan Payout',   value: `$${(totalRevenue - commission).toFixed(2)}`,                          accent: C.BLUE    },
      { label: 'Total Orders',         value: String(totalOrders),                                                    accent: C.DARK    },
      { label: 'Avg Order Value',      value: totalOrders > 0 ? `$${(totalRevenue / totalOrders).toFixed(2)}` : '—', accent: C.GREEN   },
      { label: 'Fulfillment Rate',
        value: `${fulfillmentRate}%`,
        color: fulfillmentRate >= 80 ? C.GREEN : C.RED,
        accent: fulfillmentRate >= 80 ? C.GREEN : C.RED }
    ], 3);

    if (salesData && salesData.length > 0) {
      if (y > doc.page.height - 120) { doc.addPage(); y = 50; }
      y = _pdfSectionTitle(doc, W, y, 'DAILY REVENUE — SELECTED RANGE');
      const rdCols = [
        { label: 'DATE',       w: 90 },
        { label: 'ORDERS',     w: 55,  align: 'right' },
        { label: 'REVENUE',    w: 115, align: 'right', bold: true, color: function() { return C.PRIMARY; } },
        { label: 'COMMISSION', w: 110, align: 'right' },
        { label: 'NET PAYOUT', w: W - 370, align: 'right' }
      ];
      y = _pdfTableHeader(doc, W, y, rdCols);
      salesData.forEach(function(row, i) {
        if (y > doc.page.height - 60) { doc.addPage(); y = 50; y = _pdfTableHeader(doc, W, y, rdCols); }
        const rev = Number(row.revenue || 0);
        y = _pdfTableRow(doc, y, rdCols, [
          row.date, String(row.orders || 0),
          `$${rev.toFixed(2)}`, `$${(rev*commissionRate).toFixed(2)}`, `$${(rev*(1-commissionRate)).toFixed(2)}`
        ], i);
      });
      y = _pdfTotalsRow(doc, y, rdCols, [
        'TOTAL', String(totalOrders),
        `$${totalRevenue.toFixed(2)}`, `$${commission.toFixed(2)}`, `$${(totalRevenue-commission).toFixed(2)}`
      ]);
      y += 10;
    }

    if (topArtisans && topArtisans.length > 0) {
      if (y > doc.page.height - 150) { doc.addPage(); y = 50; }
      y = _pdfSectionTitle(doc, W, y, `ARTISAN PERFORMANCE — SELECTED RANGE  (${topArtisans.length} artisans)`);
      const raCols = [
        { label: 'RANK',       w: 40 },
        { label: 'ARTISAN',    w: W - 300 },
        { label: 'SHOP',       w: 100 },
        { label: 'REVENUE',    w: 80,  align: 'right', bold: true, color: function() { return C.PRIMARY; } },
        { label: 'COMMISSION', w: 80,  align: 'right', color: function() { return C.ORANGE; } }
      ];
      y = _pdfTableHeader(doc, W, y, raCols);
      topArtisans.forEach(function(a, i) {
        if (y > doc.page.height - 60) { doc.addPage(); y = 50; y = _pdfTableHeader(doc, W, y, raCols); }
        const rev = Number(a.revenue || 0);
        y = _pdfTableRow(doc, y, raCols, [
          String(i+1), a.name||'—', a.shop_name||'—',
          `$${rev.toFixed(2)}`, `$${(rev*commissionRate).toFixed(2)}`
        ], i);
      });
    }
  }

  _pdfFooters(doc, W, reportLabel, periodLabel);
  doc.end();
}

// ─── CSV builder ──────────────────────────────────────────────────────────────
function _exportCsv(res, data) {
  const {
    type, periodLabel, generatedAt, commissionRate,
    salesData, totalRevenue, totalOrders, commission,
    statusCounts, userStats, productStats,
    topArtisans, recentOrders,
    revenueGrowth, ordersGrowth,
    prevRevenue, prevOrders,
    cancellationRate, fulfillmentRate
  } = data;

  const LABELS = {
    sales:    'Sales & Revenue Report',
    artisan:  'Artisan Performance Report',
    orders:   'Order Analytics Report',
    platform: 'Platform Overview Report',
    custom:   'Custom Date Range Report'
  };
  const reportLabel = LABELS[type] || LABELS.sales;

  const rows = [];
  rows.push([`Craftify — ${reportLabel}`]);
  rows.push([`Period: ${periodLabel}`]);
  rows.push([`Generated: ${generatedAt}`]);
  rows.push([]);

  function csvTable(header, dataRows) {
    rows.push(header);
    dataRows.forEach(function(r) { rows.push(r); });
    rows.push([]);
  }

  if (type === 'sales') {
    rows.push(['REVENUE SUMMARY']);
    rows.push(['Metric', 'Value']);
    rows.push(['Total Revenue', `$${totalRevenue.toFixed(2)}`]);
    rows.push([`Commission (${Math.round(commissionRate*100)}%)`, `$${commission.toFixed(2)}`]);
    rows.push(['Net Artisan Payout', `$${(totalRevenue-commission).toFixed(2)}`]);
    rows.push(['Total Orders', String(totalOrders)]);
    rows.push(['Avg Order Value', totalOrders > 0 ? `$${(totalRevenue/totalOrders).toFixed(2)}` : '—']);
    rows.push(['Revenue vs Prev Period', revenueGrowth !== null ? `${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth}%` : 'N/A']);
    rows.push([]);
    csvTable(
      ['Date', 'Orders', 'Gross Revenue', 'Commission', 'Artisan Payout', '% of Total'],
      (salesData || []).map(function(d) {
        const rev = Number(d.revenue || 0);
        return [d.date, String(d.orders||0), `$${rev.toFixed(2)}`,
          `$${(rev*commissionRate).toFixed(2)}`, `$${(rev*(1-commissionRate)).toFixed(2)}`,
          `${totalRevenue > 0 ? (rev/totalRevenue*100).toFixed(1) : '0.0'}%`];
      })
    );
    rows.push(['TOTAL', String(totalOrders), `$${totalRevenue.toFixed(2)}`,
      `$${commission.toFixed(2)}`, `$${(totalRevenue-commission).toFixed(2)}`, '100%']);

  } else if (type === 'artisan') {
    const totalArtisanRev = (topArtisans||[]).reduce(function(s,a){return s+Number(a.revenue||0);},0);
    rows.push(['ARTISAN PERFORMANCE SUMMARY']);
    rows.push(['Active Artisans', String((topArtisans||[]).length)]);
    rows.push(['Total Revenue Generated', `$${totalArtisanRev.toFixed(2)}`]);
    rows.push(['Commission Collected', `$${(totalArtisanRev*commissionRate).toFixed(2)}`]);
    rows.push([]);
    csvTable(
      ['Rank','Artisan Name','Shop','Gross Revenue','Commission','Net Payout','% of Total'],
      (topArtisans||[]).map(function(a,i){
        const rev=Number(a.revenue||0);
        return [i+1, a.name||'—', a.shop_name||'—',
          `$${rev.toFixed(2)}`, `$${(rev*commissionRate).toFixed(2)}`, `$${(rev*(1-commissionRate)).toFixed(2)}`,
          `${totalArtisanRev>0?(rev/totalArtisanRev*100).toFixed(1):'0.0'}%`];
      })
    );

  } else if (type === 'orders') {
    rows.push(['ORDER PERFORMANCE SUMMARY']);
    rows.push(['Total Orders', String(totalOrders)]);
    rows.push(['Orders vs Prev Period', ordersGrowth !== null ? `${ordersGrowth >= 0 ? '+' : ''}${ordersGrowth}%` : 'N/A']);
    rows.push(['Fulfillment Rate', `${fulfillmentRate}%`]);
    rows.push(['Cancellation Rate', `${cancellationRate}%`]);
    rows.push(['Avg Order Value', totalOrders > 0 ? `$${(totalRevenue/totalOrders).toFixed(2)}` : '—']);
    rows.push([]);
    csvTable(
      ['Status','Count','Percentage'],
      ['delivered','shipped','processing','cancelled','pending'].map(function(s){
        const cnt = statusCounts[s]||0;
        return [s.charAt(0).toUpperCase()+s.slice(1), String(cnt), `${Math.round(cnt/(statusCounts.total||1)*100)}%`];
      })
    );
    csvTable(
      ['Order ID','Customer','Date','Status','Items','Amount'],
      (recentOrders||[]).map(function(o){
        return [o.id||'—', o.customer_name||'—', o.created_at?String(o.created_at).slice(0,10):'—',
          o.status||'—', String(o.item_count||0), `$${Number(o.total_amount||0).toFixed(2)}`];
      })
    );

  } else if (type === 'platform') {
    rows.push(['USER STATISTICS']);
    rows.push(['Total Users', String(userStats?userStats.total||0:0)]);
    rows.push(['Customers', String(userStats?userStats.customers||0:0)]);
    rows.push(['Artisans', String(userStats?userStats.artisans||0:0)]);
    rows.push(['Suspended', String(userStats?userStats.suspended||0:0)]);
    rows.push([]);
    rows.push(['PRODUCT STATISTICS']);
    rows.push(['Total Products', String(productStats?productStats.total||0:0)]);
    rows.push(['Approved', String(productStats?productStats.approved||0:0)]);
    rows.push(['Pending Approval', String(productStats?productStats.pending||0:0)]);
    rows.push(['Rejected', String(productStats?productStats.rejected||0:0)]);
    rows.push([]);
    rows.push(['FINANCIAL SNAPSHOT']);
    rows.push(['Total Revenue', `$${totalRevenue.toFixed(2)}`]);
    rows.push(['Commission', `$${commission.toFixed(2)}`]);
    rows.push(['Total Orders', String(totalOrders)]);
    rows.push(['Cancellation Rate', `${cancellationRate}%`, cancellationRate>15?'WARNING':'OK']);

  } else {
    // custom
    rows.push(['SUMMARY']);
    rows.push(['Total Revenue', `$${totalRevenue.toFixed(2)}`]);
    rows.push([`Commission (${Math.round(commissionRate*100)}%)`, `$${commission.toFixed(2)}`]);
    rows.push(['Net Artisan Payout', `$${(totalRevenue-commission).toFixed(2)}`]);
    rows.push(['Total Orders', String(totalOrders)]);
    rows.push(['Avg Order Value', totalOrders>0?`$${(totalRevenue/totalOrders).toFixed(2)}`:'—']);
    rows.push(['Fulfillment Rate', `${fulfillmentRate}%`]);
    rows.push([]);
    csvTable(
      ['Date','Orders','Revenue','Commission','Net Payout'],
      (salesData||[]).map(function(d){
        const rev=Number(d.revenue||0);
        return [d.date, String(d.orders||0), `$${rev.toFixed(2)}`, `$${(rev*commissionRate).toFixed(2)}`, `$${(rev*(1-commissionRate)).toFixed(2)}`];
      })
    );
    csvTable(
      ['Rank','Artisan','Shop','Revenue','Commission'],
      (topArtisans||[]).map(function(a,i){
        const rev=Number(a.revenue||0);
        return [i+1, a.name||'—', a.shop_name||'—', `$${rev.toFixed(2)}`, `$${(rev*commissionRate).toFixed(2)}`];
      })
    );
  }

  const csv = rows.map(function(r) {
    return r.map(function(cell) {
      const s = String(cell);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(',');
  }).join('\r\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="craftify-${type}-report-${Date.now()}.csv"`);
  res.send(csv);
}


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
