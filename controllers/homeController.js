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
      // FIX: fall back to a.images for standalone auctions that have no linked product.
      const images = JSON.parse(a.product_images || a.images || '[]');
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

// Contact form POST
exports.contactPost = (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message ||
      typeof name !== 'string' || typeof email !== 'string' ||
      typeof subject !== 'string' || typeof message !== 'string') {
    req.flash('error_msg', 'Please fill out all required fields.');
    return res.redirect('/contact');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    req.flash('error_msg', 'Please enter a valid email address.');
    return res.redirect('/contact');
  }

  // In a real app this would send an email; for now just acknowledge
  req.flash('success_msg', "Thanks for reaching out, " + name.trim().split(' ')[0] + "! We'll get back to you within one business day.");
  res.redirect('/contact');
};

// FAQ page
exports.faq = (req, res) => {
  res.render('home/faq', { title: 'FAQ - Craftify' });
};

// Shipping & Returns page
exports.shipping = (req, res) => {
  res.render('home/shipping', { title: 'Shipping & Returns - Craftify' });
};

// Artisan Guidelines page
exports.guidelines = (req, res) => {
  res.render('home/guidelines', { title: 'Artisan Guidelines - Craftify' });
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
    const artisans = ArtisanProfile.findApprovedWithStats();
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
  } catch {
    req.flash('error_msg', 'Could not subscribe. Please try again.');
  }

  res.redirect(getSafeRedirect(req, '/'));
};
