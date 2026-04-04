const Product = require('../models/Product');
const Category = require('../models/Category');
const Review = require('../models/Review');
const Wishlist = require('../models/Wishlist');
const ArtisanProfile = require('../models/ArtisanProfile');

// List all products
exports.index = (req, res) => {
  try {
    const { category, search, sort, min_price, max_price, featured, page = 1 } = req.query;
    const limit = 12;
    const offset = (page - 1) * limit;

    const filters = {
      status: 'approved',
      limit,
      offset,
      sort: sort || 'newest'
    };

    if (category) filters.category_id = parseInt(category);
    if (search) filters.search = search;
    if (min_price) filters.minPrice = parseFloat(min_price);
    if (max_price) filters.maxPrice = parseFloat(max_price);
    if (featured) filters.featured = true;

    const products = Product.findAll(filters);
    const countFilters = { ...filters };
    delete countFilters.limit;
    delete countFilters.offset;
    delete countFilters.sort;
    const totalProducts = Product.count(countFilters);
    const totalPages = Math.ceil(totalProducts / limit);
    const categories = Category.findAll();

    // Add wishlist status for logged-in users
    if (req.session.user) {
      products.forEach(p => {
        p.inWishlist = Wishlist.isInWishlist(req.session.user.id, p.id);
      });
    }

    res.render('products/index', {
      title: 'Browse Products - Craftify',
      products,
      categories,
      filters: { category, search, sort, min_price, max_price, featured },
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Products index error:', err);
    req.flash('error_msg', 'Error loading products');
    res.redirect('/');
  }
};

// Show single product
exports.show = (req, res) => {
  try {
    const { id } = req.params;
    const product = Product.findById(id);

    if (!product || product.status !== 'approved') {
      req.flash('error_msg', 'Product not found');
      return res.redirect('/products');
    }

    // Increment views
    Product.incrementViews(id);

    // Get reviews
    const reviews = Review.findByProductId(id, { status: 'visible' });
    const ratingStats = Review.getAverageRating(id);
    const ratingDistribution = Review.getRatingDistribution(id);

    // Get related products
    const relatedProducts = Product.getRelated(id, 4);

    // Get artisan profile
    const artisan = ArtisanProfile.findByUserId(product.artisan_id);

    // Check wishlist status
    let inWishlist = false;
    let canReview = { canReview: false };
    if (req.session.user) {
      inWishlist = Wishlist.isInWishlist(req.session.user.id, id);
      canReview = Review.canReview(req.session.user.id, id);
    }

    // Parse images
    product.imageArray = JSON.parse(product.images || '[]');
    if (product.imageArray.length === 0) {
      product.imageArray = ['/images/placeholder-product.jpg'];
    }

    res.render('products/show', {
      title: `${product.name} - Craftify`,
      product,
      artisan,
      reviews,
      ratingStats,
      ratingDistribution,
      relatedProducts,
      inWishlist,
      canReview
    });
  } catch (err) {
    console.error('Product show error:', err);
    req.flash('error_msg', 'Error loading product');
    res.redirect('/products');
  }
};

// Show products by category
exports.byCategory = (req, res) => {
  try {
    const { id } = req.params;
    const category = Category.findById(id);

    if (!category) {
      req.flash('error_msg', 'Category not found');
      return res.redirect('/products');
    }

    const products = Product.findAll({ status: 'approved', category_id: id });
    const categories = Category.findAll();

    res.render('products/index', {
      title: `${category.name} - Craftify`,
      products,
      categories,
      selectedCategory: category,
      filters: { category: id }
    });
  } catch (err) {
    console.error('Products by category error:', err);
    res.redirect('/products');
  }
};

// Search products
exports.search = (req, res) => {
  const { q } = req.query;
  res.redirect(`/products?search=${encodeURIComponent(q || '')}`);
};

// Show artisan's products
exports.byArtisan = (req, res) => {
  try {
    const { id } = req.params;
    const artisan = ArtisanProfile.findByUserId(id);

    if (!artisan) {
      req.flash('error_msg', 'Artisan not found');
      return res.redirect('/products');
    }

    const products = Product.findAll({ status: 'approved', artisan_id: id });
    const stats = ArtisanProfile.getStats(id);
    const reviews = Review.findAll({ artisan_id: id, limit: 5 });

    res.render('products/artisan', {
      title: `${artisan.shop_name} - Craftify`,
      artisan,
      products,
      stats,
      reviews
    });
  } catch (err) {
    console.error('Artisan products error:', err);
    res.redirect('/products');
  }
};
