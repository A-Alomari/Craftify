const { getDb } = require('../config/database');

class Auction {
  static findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT a.*, p.name as product_name, p.images as product_images, p.description as product_description,
        c.name as category_name, u.name as artisan_name, u.avatar as artisan_avatar, ap.shop_name, ap.profile_image as artisan_profile_image,
        hu.name as highest_bidder_name,
        (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count
      FROM auctions a
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      JOIN users u ON a.artisan_id = u.id
      LEFT JOIN artisan_profiles ap ON u.id = ap.user_id
      LEFT JOIN users hu ON COALESCE(a.highest_bidder_id, a.winner_id) = hu.id
      WHERE a.id = ?
    `).get(id);
  }

  static findAll(filters = {}) {
    const db = getDb();
    let query = `
      SELECT a.*, p.name as product_name, p.images as product_images,
        c.name as category_name, u.name as artisan_name, ap.shop_name,
        (SELECT COUNT(*) FROM bids WHERE auction_id = a.id) as bid_count
      FROM auctions a
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
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
      query += ' AND (COALESCE(p.name, a.title) LIKE ? OR a.title LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.category_id) {
      query += ' AND p.category_id = ?';
      params.push(filters.category_id);
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
      product_id, artisan_id, title = '', description = '', images = '[]',
      starting_bid, starting_price, reserve_price = null, bid_increment = 1,
      start_time, end_time
    } = auctionData;

    const now = new Date();
    // FIX: BUG 3 — normalize datetime-local form values to full ISO strings.
    // Without this, "2024-03-15T10:00" (no timezone) stores inconsistently and
    // causes wrong string comparisons in the background end-task query.
    const normalizeDateTime = (dt) => {
      if (!dt) return dt;
      const d = new Date(dt);
      return Number.isNaN(d.getTime()) ? dt : d.toISOString();
    };
    const normalizedStartTime = normalizeDateTime(start_time);
    const normalizedEndTime = normalizeDateTime(end_time);

    const startDate = new Date(normalizedStartTime || start_time);
    const status = startDate <= now ? 'active' : 'pending';
    const actualStartPrice = starting_price || starting_bid;
    const product = product_id ? db.prepare('SELECT name FROM products WHERE id = ?').get(product_id) : null;
    const actualTitle = title || (product ? product.name : 'Auction');

    const result = db.prepare(`
      INSERT INTO auctions (
        product_id, artisan_id, title, description, images,
        starting_price, starting_bid, reserve_price, bid_increment,
        start_time, end_time, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      product_id || null, artisan_id, actualTitle, description, images,
      actualStartPrice, actualStartPrice, reserve_price, bid_increment,
      normalizedStartTime || start_time, normalizedEndTime || end_time, status
    );

    return this.findById(result.lastInsertRowid);
  }

  static placeBid(auctionId, userId, amount) {
    const db = getDb();
    const parsedAmount = Number.parseFloat(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Invalid bid amount');
    }

    const getMinimumBid = (auctionRecord) => {
      const increment = Number(auctionRecord.bid_increment) || 0;
      const hasCurrentBid = auctionRecord.current_highest_bid !== null
        && auctionRecord.current_highest_bid !== undefined;
      const baseBid = hasCurrentBid
        ? Number(auctionRecord.current_highest_bid)
        : Number(auctionRecord.starting_price || 0);
      return baseBid + increment;
    };

    // Load auction state from the same DB handle used for the transaction.
    const auction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
    if (!auction) {
      throw new Error('Auction not found');
    }
    if (auction.status !== 'active') {
      throw new Error('Auction is not active');
    }
    if (new Date(auction.end_time) <= new Date()) {
      throw new Error('Auction has ended');
    }
    if (Number.parseInt(auction.artisan_id, 10) === Number.parseInt(userId, 10)) {
      throw new Error('You cannot bid on your own auction');
    }

    const minBid = getMinimumBid(auction);

    if (parsedAmount < minBid) {
      throw new Error(`Minimum bid is $${minBid.toFixed(2)}`);
    }

    let inTransaction = false;

    try {
      db.exec('BEGIN TRANSACTION');
      inTransaction = true;

      // Revalidate in transaction to avoid race-condition bid acceptance.
      const freshAuction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId);
      if (!freshAuction) {
        throw new Error('Auction not found');
      }
      if (freshAuction.status !== 'active') {
        throw new Error('Auction is not active');
      }
      if (new Date(freshAuction.end_time) <= new Date()) {
        throw new Error('Auction has ended');
      }
      if (Number.parseInt(freshAuction.artisan_id, 10) === Number.parseInt(userId, 10)) {
        throw new Error('You cannot bid on your own auction');
      }

      const freshMinBid = getMinimumBid(freshAuction);
      if (parsedAmount < freshMinBid) {
        throw new Error(`Minimum bid is $${freshMinBid.toFixed(2)}`);
      }

      // Record bid.
      db.prepare(`
        INSERT INTO bids (auction_id, user_id, amount, bid_time) VALUES (?, ?, ?, datetime('now'))
      `).run(auctionId, userId, parsedAmount);

      // Update previous winning bid.
      db.prepare(`UPDATE bids SET is_winning = 0 WHERE auction_id = ? AND is_winning = 1`)
        .run(auctionId);

      // Mark new bid as winning.
      db.prepare(`
        UPDATE bids
        SET is_winning = 1
        WHERE id = (
          SELECT id FROM bids WHERE auction_id = ? ORDER BY id DESC LIMIT 1
        )
      `).run(auctionId);

      // Update auction.
      db.prepare(`
        UPDATE auctions SET current_highest_bid = ?, winner_id = ?, highest_bidder_id = ? WHERE id = ?
      `).run(parsedAmount, userId, userId, auctionId);

      const bidCount = db.prepare('SELECT COUNT(*) as count FROM bids WHERE auction_id = ?').get(auctionId)?.count || 0;
      const latestBid = db.prepare('SELECT * FROM bids WHERE auction_id = ? ORDER BY id DESC LIMIT 1').get(auctionId)
        || {
          auction_id: Number(auctionId),
          user_id: userId,
          amount: parsedAmount,
          created_at: new Date().toISOString()
        };
      const updatedAuction = db.prepare('SELECT * FROM auctions WHERE id = ?').get(auctionId)
        || {
          id: Number(auctionId),
          title: auction.title,
          current_highest_bid: parsedAmount,
          bid_increment: auction.bid_increment
        };
      updatedAuction.bid_count = bidCount;

      db.exec('COMMIT');
      inTransaction = false;

      return {
        bid: latestBid,
        auction: updatedAuction,
        previousBidderId: auction.winner_id
      };
    } catch (err) {
      if (inTransaction) {
        try { db.exec('ROLLBACK'); } catch (rollbackErr) { /* noop */ }
      }
      throw err;
    }
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
    // Returns the user's single highest bid per auction (deduped by auction_id).
    // Includes category_name, highest_bidder_id, and both image sources.
    let query = `
      SELECT b.id, b.auction_id, b.user_id, b.amount, b.is_winning, b.created_at,
        a.title, a.images as auction_images, a.end_time, a.status as auction_status,
        a.current_highest_bid, a.winner_id, a.highest_bidder_id,
        p.images as product_images, p.name as product_name,
        cat.name as category_name
      FROM bids b
      JOIN auctions a ON b.auction_id = a.id
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN categories cat ON p.category_id = cat.id
      WHERE b.user_id = ?
        AND b.id = (
          SELECT id FROM bids b2
          WHERE b2.user_id = ? AND b2.auction_id = b.auction_id
          ORDER BY b2.amount DESC, b2.id DESC
          LIMIT 1
        )
      ORDER BY b.created_at DESC
    `;
    const params = [userId, userId];

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
