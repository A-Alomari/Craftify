const { getDb } = require('../config/database');

class Wishlist {
  static findByUserId(userId) {
    const db = getDb();
    return db.prepare(`
      SELECT w.*, p.name, p.price, p.images, p.stock, p.artisan_id,
        ap.shop_name,
        (SELECT AVG(rating) FROM reviews WHERE product_id = p.id AND is_approved = 1) as avg_rating
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      LEFT JOIN artisan_profiles ap ON p.artisan_id = ap.user_id
      WHERE w.user_id = ? AND p.status = 'approved'
      ORDER BY w.created_at DESC
    `).all(userId);
  }

  static isInWishlist(userId, productId) {
    const db = getDb();
    const item = db.prepare(
      'SELECT 1 FROM wishlist WHERE user_id = ? AND product_id = ?'
    ).get(userId, productId);
    return !!item;
  }

  static add(userId, productId) {
    const db = getDb();
    try {
      db.prepare(`
        INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)
      `).run(userId, productId);
      return true;
    } catch (err) {
      return false;
    }
  }

  static remove(userId, productId) {
    const db = getDb();
    return db.prepare(
      'DELETE FROM wishlist WHERE user_id = ? AND product_id = ?'
    ).run(userId, productId);
  }

  static toggle(userId, productId) {
    if (this.isInWishlist(userId, productId)) {
      this.remove(userId, productId);
      return false;
    } else {
      this.add(userId, productId);
      return true;
    }
  }

  static clear(userId) {
    const db = getDb();
    return db.prepare('DELETE FROM wishlist WHERE user_id = ?').run(userId);
  }

  static count(userId) {
    const db = getDb();
    const result = db.prepare(
      'SELECT COUNT(*) as count FROM wishlist WHERE user_id = ?'
    ).get(userId);
    return result?.count || 0;
  }

  static moveToCart(userId, productId) {
    const Cart = require('./Cart');
    Cart.addItem(userId, null, productId, 1);
    this.remove(userId, productId);
    return true;
  }
}

module.exports = Wishlist;
