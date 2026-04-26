const database = require('../config/database');

class ArtisanProfile {
  static findByUserId(userId) {
    const db = database.getDb();
    return db.prepare(`
      SELECT ap.*, u.name, u.email, u.avatar, u.status, u.phone as account_phone, u.created_at as user_created_at
      FROM artisan_profiles ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.user_id = ?
    `).get(userId);
  }

  static findById(id) {
    const db = database.getDb();
    return db.prepare(`
      SELECT ap.*, u.name, u.email, u.avatar, u.status, u.phone as account_phone
      FROM artisan_profiles ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.id = ?
    `).get(id);
  }

  static findAll(filters = {}) {
    const db = database.getDb();
    let query = `
      SELECT ap.*, u.name, u.email, u.avatar, u.status,
        (SELECT COUNT(*) FROM products WHERE artisan_id = ap.user_id AND status = 'approved') as product_count,
        (SELECT AVG(r.rating) FROM reviews r JOIN products p ON r.product_id = p.id WHERE p.artisan_id = ap.user_id) as avg_rating
      FROM artisan_profiles ap
      JOIN users u ON ap.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.approved !== undefined) {
      query += ' AND ap.is_approved = ?';
      params.push(filters.approved ? 1 : 0);
    }
    if (filters.status) {
      query += ' AND u.status = ?';
      params.push(filters.status);
    }
    if (filters.search) {
      query += ' AND (ap.shop_name LIKE ? OR u.name LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY ap.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  static create(profileData) {
    const db = database.getDb();
    const { user_id, shop_name, bio = '', profile_image = '', banner_image = '', shipping_methods = '[]', return_policy = '' } = profileData;

    const result = db.prepare(`
      INSERT INTO artisan_profiles (user_id, shop_name, bio, profile_image, banner_image, shipping_methods, return_policy)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(user_id, shop_name, bio, profile_image, banner_image, shipping_methods, return_policy);

    return this.findById(result.lastInsertRowid);
  }

  static update(userId, profileData) {
    const db = database.getDb();
    const fields = [];
    const params = [];

    const allowedColumns = [
      'shop_name', 'bio', 'logo', 'banner', 'profile_image', 'banner_image',
      'location', 'phone', 'instagram', 'facebook', 'twitter', 'website',
      'bank_name', 'bank_account', 'shipping_methods', 'return_policy', 'is_approved'
    ];

    Object.entries(profileData).forEach(([key, value]) => {
      if (
        value !== undefined &&
        key !== 'user_id' &&
        key !== 'id' &&
        allowedColumns.includes(key)
      ) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (fields.length === 0) return null;

    params.push(userId);

    db.prepare(`UPDATE artisan_profiles SET ${fields.join(', ')} WHERE user_id = ?`).run(...params);
    return this.findByUserId(userId);
  }

  static approve(userId) {
    const db = database.getDb();
    db.prepare('UPDATE artisan_profiles SET is_approved = 1 WHERE user_id = ?').run(userId);
    return this.findByUserId(userId);
  }

  static reject(userId) {
    const db = database.getDb();
    db.prepare('UPDATE artisan_profiles SET is_approved = 0 WHERE user_id = ?').run(userId);
    return this.findByUserId(userId);
  }

  static getStats(userId) {
    const db = database.getDb();
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE artisan_id = ? AND status = 'approved') as total_products,
        (SELECT COUNT(*) FROM products WHERE artisan_id = ?) as all_products,
        (SELECT COUNT(DISTINCT o.id) FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id WHERE p.artisan_id = ?) as total_orders,
        (SELECT COALESCE(SUM(oi.total_price), 0) FROM order_items oi JOIN orders o ON oi.order_id = o.id JOIN products p ON oi.product_id = p.id WHERE p.artisan_id = ? AND o.payment_status = 'paid') as total_revenue,
        (SELECT COUNT(*) FROM auctions WHERE artisan_id = ? AND status = 'active') as active_auctions,
        (SELECT AVG(r.rating) FROM reviews r JOIN products p ON r.product_id = p.id WHERE p.artisan_id = ?) as avg_rating,
        (SELECT COUNT(DISTINCT o.id) FROM orders o JOIN order_items oi ON o.id = oi.order_id JOIN products p ON oi.product_id = p.id WHERE p.artisan_id = ? AND o.status IN ('pending','confirmed','processing')) as open_orders,
        (SELECT COALESCE(SUM(views), 0) FROM products WHERE artisan_id = ? AND status = 'approved') as total_views
    `).get(userId, userId, userId, userId, userId, userId, userId, userId);

    return stats || { total_products: 0, all_products: 0, total_orders: 0, total_revenue: 0, active_auctions: 0, avg_rating: null, open_orders: 0, total_views: 0 };
  }

  static getFeatured(limit = 6) {
    const db = database.getDb();
    return db.prepare(`
      SELECT ap.*, u.name, u.avatar,
        (SELECT COUNT(*) FROM products WHERE artisan_id = ap.user_id AND status = 'approved') as product_count,
        (SELECT AVG(r.rating) FROM reviews r JOIN products p ON r.product_id = p.id WHERE p.artisan_id = ap.user_id) as avg_rating
      FROM artisan_profiles ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.is_approved = 1 AND u.status = 'active'
      ORDER BY product_count DESC, avg_rating DESC
      LIMIT ?
    `).all(limit);
  }

  static count(filters = {}) {
    const db = database.getDb();
    let query = 'SELECT COUNT(*) as count FROM artisan_profiles ap JOIN users u ON ap.user_id = u.id WHERE 1=1';
    const params = [];

    if (filters.approved !== undefined) {
      query += ' AND ap.is_approved = ?';
      params.push(filters.approved ? 1 : 0);
    }

    return db.prepare(query).get(...params)?.count || 0;
  }

  // WHY: The artisans-directory page needs a join across users + profiles + products + reviews.
  // Keeping this SQL in the model preserves the MVC contract — controllers must not call getDb().
  static findApprovedWithStats() {
    const db = database.getDb();
    return db.prepare(`
      SELECT
        u.id, u.name, u.email,
        ap.shop_name, ap.bio, ap.profile_image,
        COUNT(DISTINCT p.id) as product_count,
        AVG(r.rating) as avg_rating,
        COUNT(DISTINCT r.id) as review_count
      FROM users u
      INNER JOIN artisan_profiles ap ON u.id = ap.user_id
      LEFT JOIN products p ON u.id = p.artisan_id AND p.status = 'approved'
      LEFT JOIN reviews r ON p.id = r.product_id AND r.is_approved = 1
      WHERE u.role = 'artisan' AND u.status = 'active' AND ap.is_approved = 1
      GROUP BY u.id, u.name, u.email, ap.shop_name, ap.bio, ap.profile_image
      ORDER BY review_count DESC, product_count DESC
    `).all();
  }
}

module.exports = ArtisanProfile;
