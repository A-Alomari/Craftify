const Product = require('../models/Product');
const Category = require('../models/Category');
const ArtisanProfile = require('../models/ArtisanProfile');
const Cart = require('../models/Cart');
const Notification = require('../models/Notification');
const Wishlist = require('../models/Wishlist');
const Auction = require('../models/Auction');
const Coupon = require('../models/Coupon');

exports.products = (req, res) => {
  try {
    const products = Product.findAll({ status: 'approved', limit: 20 }).map(product => ({
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category_name,
      artisan: product.shop_name || product.artisan_name
    }));

    return res.json(products);
  } catch (err) {
    return res.status(500).json({ error: 'Unable to load products' });
  }
};

exports.cartCount = (req, res) => {
  try {
    let count = 0;
    if (req.user) {
      count = Cart.getCount(req.user.id);
    } else if (req.sessionID) {
      count = Cart.getCount(null, req.sessionID);
    }

    return res.json({ count });
  } catch (err) {
    return res.status(500).json({ count: 0, error: 'Unable to load cart count' });
  }
};

exports.notifications = (req, res) => {
  if (!req.user) {
    return res.json({ notifications: [], count: 0 });
  }

  try {
    const notifications = Notification.findByUserId(req.user.id, { unread: true, limit: 5 });
    const count = Notification.getUnreadCount(req.user.id);
    return res.json({ notifications, count });
  } catch (err) {
    return res.status(500).json({ notifications: [], count: 0, error: 'Unable to load notifications' });
  }
};

exports.wishlistCheck = (req, res) => {
  if (!req.user) {
    return res.json({ inWishlist: false });
  }
  const inWishlist = Wishlist.isInWishlist(req.user.id, req.params.productId);
  return res.json({ inWishlist });
};

exports.auctionUpdates = (req, res) => {
  try {
    const auction = Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const bids = Auction.getBids(req.params.id, 5);

    return res.json({
      currentBid: auction.current_highest_bid || auction.starting_price,
      highestBidderId: auction.winner_id,
      bidCount: auction.bid_count,
      status: auction.status,
      recentBids: bids
    });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};

exports.validateCoupon = (req, res) => {
  const { code, total } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ valid: false, error: 'Coupon code is required' });
  }

  const parsedTotal = Number.parseFloat(total);
  if (!Number.isFinite(parsedTotal)) {
    return res.status(400).json({ valid: false, error: 'Order total is invalid' });
  }

  try {
    const validation = Coupon.validate(code, parsedTotal);
    return res.json(validation);
  } catch (err) {
    return res.status(500).json({ valid: false, error: 'Error validating coupon' });
  }
};

exports.searchSuggestions = (req, res) => {
  const { q } = req.query;

  if (!q || q.length < 2) {
    return res.json({ suggestions: [] });
  }

  try {
    const products = Product.findAll({ status: 'approved', search: q, limit: 5 });
    const categories = Category.findAll().filter(category =>
      category.name.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 3);
    const artisans = ArtisanProfile.findAll({ approved: true, search: q, limit: 3 });

    return res.json({
      suggestions: [
        ...products.map(p => ({ type: 'product', name: p.name })),
        ...categories.map(c => ({ type: 'category', name: c.name })),
        ...artisans.map(a => ({ type: 'artisan', name: a.shop_name }))
      ]
    });
  } catch (err) {
    return res.status(500).json({ suggestions: [], error: 'Unable to load suggestions' });
  }
};
