const Product = require('../models/Product');
const Category = require('../models/Category');
const ArtisanProfile = require('../models/ArtisanProfile');
const Auction = require('../models/Auction');
const NewsletterSubscription = require('../models/NewsletterSubscription');
const { getSafeRedirect } = require('../utils/redirect');

// Home page
exports.index = (req, res) => {
  try {
    const featuredProducts = Product.getFeatured(8);
    const newArrivals = Product.getNewArrivals(8);
    const categories = Category.findAll(false);
    const featuredArtisans = ArtisanProfile.getFeatured(4);
    const activeAuctions = Auction.getEndingSoon(4);

    // Parse product images
    const parseImages = (items) => {
      items.forEach(p => {
        const images = JSON.parse(p.images || '[]');
        p.image = images[0] || '/images/placeholder-product.jpg';
      });
    };
    parseImages(featuredProducts);
    parseImages(newArrivals);
    
    // Parse auction images
    activeAuctions.forEach(a => {
      const images = JSON.parse(a.product_images || '[]');
      a.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('home/index', {
      title: 'Craftify - Handmade by Local Artisans',
      featuredProducts,
      newArrivals,
      categories,
      featuredArtisans,
      activeAuctions
    });
  } catch (err) {
    console.error('Home page error:', err);
    res.render('home/index', {
      title: 'Craftify - Handmade by Local Artisans',
      featuredProducts: [],
      newArrivals: [],
      categories: [],
      featuredArtisans: [],
      activeAuctions: []
    });
  }
};

// About page
exports.about = (req, res) => {
  res.render('home/about', { title: 'About Us - Craftify' });
};

// Contact page
exports.contact = (req, res) => {
  res.render('home/contact', { title: 'Contact Us - Craftify' });
};

// FAQ page
exports.faq = (req, res) => {
  res.render('home/faq', { title: 'FAQ - Craftify' });
};

// Terms of Service
exports.terms = (req, res) => {
  res.render('home/terms', { title: 'Terms of Service - Craftify' });
};

// Privacy Policy
exports.privacy = (req, res) => {
  res.render('home/privacy', { title: 'Privacy Policy - Craftify' });
};

// Artisans directory
exports.artisans = (req, res) => {
  try {
    const { getDb } = require('../config/database');
    const db = getDb();
    
    const artisans = db.prepare(`
      SELECT 
        u.id, u.name, u.email,
        ap.shop_name, ap.bio, ap.profile_image, ap.is_featured,
        COUNT(DISTINCT p.id) as product_count,
        AVG(r.rating) as avg_rating,
        COUNT(DISTINCT r.id) as review_count
      FROM users u
      INNER JOIN artisan_profiles ap ON u.id = ap.user_id
      LEFT JOIN products p ON u.id = p.artisan_id AND p.status = 'approved'
      LEFT JOIN reviews r ON p.id = r.product_id AND r.status = 'approved'
      WHERE u.role = 'artisan' AND u.status = 'active' AND ap.status = 'approved'
      GROUP BY u.id, u.name, u.email, ap.shop_name, ap.bio, ap.profile_image, ap.is_featured
      ORDER BY ap.is_featured DESC, review_count DESC, product_count DESC
    `).all();
    
    res.render('home/artisans', {
      title: 'Discover Artisans - Craftify',
      artisans
    });
  } catch (err) {
    console.error('Artisans page error:', err);
    req.flash('error_msg', 'Error loading artisans');
    res.redirect('/');
  }
};

// Newsletter subscription
exports.subscribe = (req, res) => {
  const { email } = req.body;
  
  try {
    // Validate email format
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      req.flash('error_msg', 'Please enter a valid email address');
      return res.redirect(getSafeRedirect(req, '/'));
    }
    
    NewsletterSubscription.subscribe(email.trim().toLowerCase());
    req.flash('success_msg', 'Thank you for subscribing to our newsletter!');
  } catch (err) {
    req.flash('error_msg', 'Could not subscribe. Please try again.');
  }

  res.redirect(getSafeRedirect(req, '/'));
};
