const { getDb } = require('../config/database');

class Auction {
  static findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT a.*, p.name as product_name, p.images as product_images, p.description as product_description,
        u.name as artisan_name, ap.shop_name,
        wu.name as highest_bidder_name,
        (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count
      FROM auctions a
      JOIN products p ON a.product_id = p.id
      JOIN users u ON a.artisan_id = u.id
      LEFT JOIN artisan_profiles ap ON u.id = ap.user_id
      LEFT JOIN users wu ON a.winner_id = wu.id
      WHERE a.id = ?
    `).get(id);
  }

  static findAll(filters = {}) {
    const db = getDb();
    let query = `
      SELECT a.*, p.name as product_name, p.images as product_images,
        u.name as artisan_name, ap.shop_name,
        (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count
      FROM auctions a
      JOIN products p ON a.product_id = p.id
      JOIN users u ON a.artisan_id = u.id
      LEFT JOIN artisan_profiles ap ON u.id = ap.user_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ' AND a.status = ?';
      params.push(filters.status);
    }
    if (filters.artisan_id) {
      query += ' AND a.artisan_id = ?';
      params.push(filters.artisan_id);
    }
    if (filters.active) {
      query += " AND a.status = 'active' AND a.end_time > datetime('now')";
    }
    if (filters.ending_soon) {
      query += " AND a.status = 'active' AND a.end_time <= datetime('now', '+1 hour')";
    }
    if (filters.search) {
      query += ' AND (p.name LIKE ? OR a.title LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const sortOptions = {
      'ending_soon': 'a.end_time ASC',
      'newest': 'a.created_at DESC',
      'most_bids': 'bid_count DESC',
      'highest_bid': 'a.current_highest_bid DESC'
    };
    query += ` ORDER BY ${sortOptions[filters.sort] || 'a.end_time ASC'}`;

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }
    if (filters.offset) {
      query += ' OFFSET ?';
      params.push(filters.offset);
    }

    return db.prepare(query).all(...params);
  }

  static create(auctionData) {
    const db = getDb();
    const {
      product_id, artisan_id, title = '', description = '',
      starting_bid, starting_price, reserve_price = null, bid_increment = 1,
      start_time, end_time
    } = auctionData;

    const now = new Date();
    const startDate = new Date(start_time);
    const status = startDate <= now ? 'active' : 'pending';
    const actualStartPrice = starting_price || starting_bid;
    const product = db.prepare('SELECT name FROM products WHERE id = ?').get(product_id);
    const actualTitle = title || (product ? product.name : 'Auction');

    const result = db.prepare(`
      INSERT INTO auctions (
        product_id, artisan_id, title, description,
        starting_price, starting_bid, reserve_price, bid_increment,
        start_time, end_time, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product_id, artisan_id, actualTitle, description,
      actualStartPrice, actualStartPrice, reserve_price, bid_increment,
      start_time, end_time, status
    );

    return this.findById(result.lastInsertRowid);
  }

  static placeBid(auctionId, userId, amount) {
    const db = getDb();
    const auction = this.findById(auctionId);
    if (!auction) throw new Error('Auction not found');
    if (auction.status !== 'active') throw new Error('Auction is not active');
    if (new Date(auction.end_time) <= new Date()) throw new Error('Auction has ended');

    const currentBid = auction.current_highest_bid || auction.starting_price;
    const minBid = currentBid ? currentBid + auction.bid_increment : auction.starting_price;

    if (amount < minBid) {
      throw new Error(`Bid must be at least $${minBid.toFixed(2)}`);
    }

    // Record bid
    const result = db.prepare(`
      INSERT INTO bids (auction_id, user_id, amount, bid_time) VALUES (?, ?, ?, datetime('now'))
    `).run(auctionId, userId, amount);

    // Update previous winning bid
    db.prepare(`UPDATE bids SET is_winning = 0 WHERE auction_id = ? AND id != ?`)
      .run(auctionId, result.lastInsertRowid);

    // Mark new bid as winning
    db.prepare(`UPDATE bids SET is_winning = 1 WHERE id = ?`)
      .run(result.lastInsertRowid);

    // Update auction
    db.prepare(`
      UPDATE auctions SET current_highest_bid = ?, winner_id = ?, highest_bidder_id = ? WHERE id = ?
    `).run(amount, userId, userId, auctionId);

    const previousBidder = auction.winner_id;

    return {
      bid: db.prepare('SELECT * FROM bids WHERE id = ?').get(result.lastInsertRowid),
      auction: this.findById(auctionId),
      previousBidderId: previousBidder
    };
  }

  static getBids(auctionId, limit = null) {
    const db = getDb();
    let query = `
      SELECT b.*, u.name as bidder_name
      FROM bids b
      JOIN users u ON b.user_id = u.id
      WHERE b.auction_id = ?
      ORDER BY b.created_at DESC
    `;
    const params = [auctionId];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    return db.prepare(query).all(...params);
  }

  static getUserBids(userId, limit = null) {
    const db = getDb();
    let query = `
      SELECT b.*, a.title, a.end_time, a.status as auction_status,
        a.current_highest_bid, a.winner_id,
        p.images as product_images, p.name as product_name
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      JOIN products p ON a.product_id = p.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `;
    const params = [userId];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    return db.prepare(query).all(...params);
  }

  static cancel(id) {
    const db = getDb();
    db.prepare("UPDATE auctions SET status = 'cancelled' WHERE id = ?").run(id);
    return this.findById(id);
  }

  static endAuction(id) {
    const db = getDb();
    const auction = this.findById(id);
    if (!auction) return null;

    const newStatus = auction.winner_id ? 'sold' : 'ended';
    db.prepare('UPDATE auctions SET status = ? WHERE id = ?').run(newStatus, id);

    return this.findById(id);
  }

  static getActive(limit = 10) {
    return this.findAll({ active: true, limit });
  }

  static getEndingSoon(limit = 6) {
    return this.findAll({ active: true, sort: 'ending_soon', limit });
  }

  static count(filters = {}) {
    const db = getDb();
    let query = 'SELECT COUNT(*) as count FROM auctions WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.artisan_id) {
      query += ' AND artisan_id = ?';
      params.push(filters.artisan_id);
    }

    return db.prepare(query).get(...params)?.count || 0;
  }

  static getStats() {
    return {
      total: this.count(),
      active: this.count({ status: 'active' }),
      pending: this.count({ status: 'pending' }),
      ended: this.count({ status: 'ended' }),
      sold: this.count({ status: 'sold' })
    };
  }
}

module.exports = Auction;
