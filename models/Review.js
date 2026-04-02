const { getDb } = require('../config/database');

class Review {
  static findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT r.*, u.name as reviewer_name, u.avatar as reviewer_avatar,
        p.name as product_name
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      JOIN products p ON r.product_id = p.id
      WHERE r.id = ?
    `).get(id);
  }

  static findByProductId(productId, filters = {}) {
    const db = getDb();
    let query = `
      SELECT r.*, u.name as reviewer_name, u.avatar as reviewer_avatar
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ?
    `;
    const params = [productId];

    if (filters.status === 'visible' || filters.approved) {
      query += ' AND r.is_approved = 1';
    }

    query += ' ORDER BY r.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  static findByUserId(userId, limit = null) {
    const db = getDb();
    let query = `
      SELECT r.*, p.name as product_name, p.images
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `;
    const params = [userId];

    if (limit) {
      query += ' LIMIT ?';
      params.push(limit);
    }

    return db.prepare(query).all(...params);
  }

  static findAll(filters = {}) {
    const db = getDb();
    let query = `
      SELECT r.*, u.name as reviewer_name, p.name as product_name,
        ap.shop_name as artisan_shop
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      JOIN products p ON r.product_id = p.id
      LEFT JOIN artisan_profiles ap ON p.artisan_id = ap.user_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status === 'visible' || filters.approved) {
      query += ' AND r.is_approved = 1';
    }
    if (filters.artisan_id) {
      query += ' AND p.artisan_id = ?';
      params.push(filters.artisan_id);
    }
    if (filters.rating) {
      query += ' AND r.rating = ?';
      params.push(filters.rating);
    }

    query += ' ORDER BY r.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  static create(reviewData) {
    const db = getDb();
    const { product_id, user_id, order_id = null, rating, title = '', comment = '' } = reviewData;

    const existing = db.prepare(
      'SELECT id FROM reviews WHERE product_id = ? AND user_id = ?'
    ).get(product_id, user_id);

    if (existing) {
      throw new Error('You have already reviewed this product');
    }

    const result = db.prepare(`
      INSERT INTO reviews (product_id, user_id, order_id, rating, title, comment, is_approved)
      VALUES (?, ?, ?, ?, ?, ?, 0)
    `).run(product_id, user_id, order_id, rating, title, comment);

    return this.findById(result.lastInsertRowid);
  }

  static update(id, reviewData) {
    const db = getDb();
    const { rating, title, comment } = reviewData;

    db.prepare(`
      UPDATE reviews SET rating = ?, title = ?, comment = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(rating, title, comment, id);

    return this.findById(id);
  }

  static updateStatus(id, status) {
    const db = getDb();
    const approved = (status === 'visible' || status === 'approved') ? 1 : 0;
    db.prepare('UPDATE reviews SET is_approved = ? WHERE id = ?').run(approved, id);
    return this.findById(id);
  }

  static delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM reviews WHERE id = ?').run(id);
  }

  static incrementHelpful(id) {
    const db = getDb();
    db.prepare('UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?').run(id);
  }

  static getAverageRating(productId) {
    const db = getDb();
    const result = db.prepare(`
      SELECT AVG(rating) as avg_rating, COUNT(*) as count
      FROM reviews
      WHERE product_id = ? AND is_approved = 1
    `).get(productId);
    return result || { avg_rating: null, count: 0 };
  }

  static getRatingDistribution(productId) {
    const db = getDb();
    return db.prepare(`
      SELECT rating, COUNT(*) as count
      FROM reviews
      WHERE product_id = ? AND is_approved = 1
      GROUP BY rating
      ORDER BY rating DESC
    `).all(productId);
  }

  static getArtisanAverageRating(artisanId) {
    const db = getDb();
    const result = db.prepare(`
      SELECT AVG(r.rating) as avg_rating, COUNT(*) as count
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      WHERE p.artisan_id = ? AND r.is_approved = 1
    `).get(artisanId);
    return result || { avg_rating: null, count: 0 };
  }

  static canReview(userId, productId) {
    const db = getDb();
    const purchased = db.prepare(`
      SELECT 1 FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'
      LIMIT 1
    `).get(userId, productId);

    const reviewed = db.prepare(
      'SELECT 1 FROM reviews WHERE user_id = ? AND product_id = ?'
    ).get(userId, productId);

    return { canReview: !!purchased && !reviewed, hasPurchased: !!purchased, hasReviewed: !!reviewed };
  }

  static count(filters = {}) {
    const db = getDb();
    let query = 'SELECT COUNT(*) as count FROM reviews r WHERE 1=1';
    const params = [];

    if (filters.status === 'visible' || filters.approved) {
      query += ' AND r.is_approved = 1';
    }
    if (filters.artisan_id) {
      query += ' AND r.product_id IN (SELECT id FROM products WHERE artisan_id = ?)';
      params.push(filters.artisan_id);
    }

    return db.prepare(query).get(...params)?.count || 0;
  }
}

module.exports = Review;
