const express = require('express');
const router = express.Router();
const { attachUser } = require('../middleware/auth');

router.use(attachUser);

// Cart count
router.get('/cart/count', (req, res) => {
  const Cart = require('../models/Cart');
  try {
    let count = 0;
    if (req.user) {
      count = Cart.getCount(req.user.id);
    } else if (req.sessionID) {
      count = Cart.getCount(null, req.sessionID);
    }
    res.json({ count });
  } catch (err) {
    res.json({ count: 0 });
  }
});

// Notifications
router.get('/notifications', (req, res) => {
  if (!req.user) {
    return res.json({ notifications: [], count: 0 });
  }
  const Notification = require('../models/Notification');
  try {
    const notifications = Notification.findByUserId(req.user.id, { unread: true, limit: 5 });
    const count = Notification.getUnreadCount(req.user.id);
    res.json({ notifications, count });
  } catch (err) {
    res.json({ notifications: [], count: 0 });
  }
});

// Wishlist check
router.get('/wishlist/check/:productId', (req, res) => {
  if (!req.user) {
    return res.json({ inWishlist: false });
  }
  const Wishlist = require('../models/Wishlist');
  const inWishlist = Wishlist.isInWishlist(req.user.id, req.params.productId);
  res.json({ inWishlist });
});

// Auction updates
router.get('/auctions/:id/updates', (req, res) => {
  const Auction = require('../models/Auction');
  try {
    const auction = Auction.findById(req.params.id);
    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const bids = Auction.getBids(req.params.id, 5);

    res.json({
      currentBid: auction.current_highest_bid || auction.starting_price,
      highestBidderId: auction.winner_id,
      bidCount: auction.bid_count,
      status: auction.status,
      recentBids: bids
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Validate coupon
router.post('/coupons/validate', (req, res) => {
  const Coupon = require('../models/Coupon');
  const { code, total } = req.body;

  try {
    const validation = Coupon.validate(code, parseFloat(total));
    res.json(validation);
  } catch (err) {
    res.json({ valid: false, error: 'Error validating coupon' });
  }
});

// Search suggestions
router.get('/search/suggestions', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json({ suggestions: [] });
  }

  try {
    const { getDb } = require('../config/database');
    const db = getDb();

    const products = db.prepare(`
      SELECT name FROM products 
      WHERE status = 'approved' AND name LIKE ?
      LIMIT 5
    `).all(`%${q}%`);

    const categories = db.prepare(`
      SELECT name FROM categories WHERE name LIKE ?
      LIMIT 3
    `).all(`%${q}%`);

    const artisans = db.prepare(`
      SELECT shop_name FROM artisan_profiles 
      WHERE is_approved = 1 AND shop_name LIKE ?
      LIMIT 3
    `).all(`%${q}%`);

    res.json({
      suggestions: [
        ...products.map(p => ({ type: 'product', name: p.name })),
        ...categories.map(c => ({ type: 'category', name: c.name })),
        ...artisans.map(a => ({ type: 'artisan', name: a.shop_name }))
      ]
    });
  } catch (err) {
    res.json({ suggestions: [] });
  }
});

module.exports = router;
