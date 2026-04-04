const Auction = require('../models/Auction');
const Product = require('../models/Product');
const Notification = require('../models/Notification');

// List auctions
exports.index = (req, res) => {
  try {
    const { status = 'active', sort = 'ending_soon', page = 1 } = req.query;
    const limit = 12;
    const offset = (page - 1) * limit;

    const filters = { limit, offset, sort };
    if (status === 'active') {
      filters.active = true;
    } else if (status !== 'all') {
      filters.status = status;
    }

    const auctions = Auction.findAll(filters);
    const totalAuctions = Auction.count(status === 'active' ? { status: 'active' } : {});
    const totalPages = Math.ceil(totalAuctions / limit);

    auctions.forEach(a => {
      const images = JSON.parse(a.product_images || '[]');
      a.image = images[0] || '/images/placeholder-product.jpg';
    });

    res.render('auctions/index', {
      title: 'Live Auctions - Craftify',
      auctions,
      filters: { status, sort },
      pagination: {
        current: parseInt(page),
        total: totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (err) {
    console.error('Auctions index error:', err);
    req.flash('error_msg', 'Error loading auctions');
    res.redirect('/');
  }
};

// Show single auction
exports.show = (req, res) => {
  try {
    const { id } = req.params;
    const auction = Auction.findById(id);

    if (!auction) {
      req.flash('error_msg', 'Auction not found');
      return res.redirect('/auctions');
    }

    const bids = Auction.getBids(id, 20);
    const userBid = req.session.user 
      ? bids.find(b => b.user_id === req.session.user.id) 
      : null;

    const images = JSON.parse(auction.product_images || '[]');
    auction.imageArray = images.length > 0 ? images : ['/images/placeholder-product.jpg'];

    const endTime = new Date(auction.end_time);
    const now = new Date();
    const timeRemaining = Math.max(0, endTime - now);

    res.render('auctions/show', {
      title: `${auction.title || auction.product_name} - Craftify`,
      auction,
      bids,
      userBid,
      timeRemaining,
      isActive: auction.status === 'active' && timeRemaining > 0
    });
  } catch (err) {
    console.error('Auction show error:', err);
    res.redirect('/auctions');
  }
};

// Place bid
exports.placeBid = (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    const io = req.app.get('io');

    const result = Auction.placeBid(id, req.session.user.id, parseFloat(amount));

    if (result.previousBidderId && result.previousBidderId !== req.session.user.id) {
      Notification.auctionOutbid(
        result.previousBidderId,
        id,
        result.auction.title || result.auction.product_name
      );
    }

    const normalizedAuctionId = Number.parseInt(id, 10) || id;
    const bidUpdatePayload = {
      auctionId: normalizedAuctionId,
      amount: result.bid.amount,
      currentBid: result.auction.current_highest_bid,
      bidCount: result.auction.bid_count,
      bidderId: req.session.user.id,
      bidderName: req.session.user.name,
      bidIncrement: result.auction.bid_increment,
      bidTime: result.bid.bid_time || result.bid.created_at
    };

    io.to(`auction-${id}`).emit('bidUpdate', bidUpdatePayload);

    // Keep legacy event for compatibility with any existing clients.
    io.to(`auction-${id}`).emit('new-bid', {
      auctionId: normalizedAuctionId,
      amount: result.bid.amount,
      bidderId: req.session.user.id,
      bidderName: req.session.user.name,
      bidTime: result.bid.bid_time || result.bid.created_at,
      totalBids: result.auction.bid_count
    });

    if (req.xhr) {
      return res.json({
        success: true,
        message: 'Bid placed successfully!',
        bid: result.bid,
        auction: result.auction
      });
    }

    req.flash('success_msg', 'Bid placed successfully!');
    res.redirect(`/auctions/${id}`);
  } catch (err) {
    console.error('Place bid error:', err);
    if (req.xhr) {
      return res.status(400).json({ success: false, message: err.message });
    }
    req.flash('error_msg', err.message);
    res.redirect(`/auctions/${req.params.id}`);
  }
};

// Get user's bids
exports.myBids = (req, res) => {
  try {
    const bids = Auction.getUserBids(req.session.user.id);

    bids.forEach(b => {
      const images = JSON.parse(b.product_images || '[]');
      b.image = images[0] || '/images/placeholder-product.jpg';
      b.isWinning = b.winner_id === req.session.user.id;
    });

    res.render('auctions/my-bids', {
      title: 'My Bids - Craftify',
      bids
    });
  } catch (err) {
    console.error('My bids error:', err);
    req.flash('error_msg', 'Error loading bids');
    res.redirect('/');
  }
};

// Get auction data for API
exports.getAuctionData = (req, res) => {
  try {
    const { id } = req.params;
    const auction = Auction.findById(id);

    if (!auction) {
      return res.status(404).json({ error: 'Auction not found' });
    }

    const bids = Auction.getBids(id, 10);

    res.json({
      auction: {
        id: auction.id,
        current_highest_bid: auction.current_highest_bid,
        winner_id: auction.winner_id,
        highest_bidder_name: auction.highest_bidder_name,
        end_time: auction.end_time,
        status: auction.status,
        bid_count: auction.bid_count
      },
      bids: bids.map(b => ({
        amount: b.amount,
        bidder_name: b.bidder_name,
        bid_time: b.created_at
      }))
    });
  } catch (err) {
    console.error('Get auction data error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
