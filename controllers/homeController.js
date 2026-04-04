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
