const { getDb } = require('../config/database');

class Cart {
  // Cart works directly with cart_items table (no separate carts table)
  
  static getItems(userId = null, sessionId = null) {
    const db = getDb();
    if (userId) {
      return db.prepare(`
        SELECT ci.*, p.name, p.price, p.images, p.stock, p.artisan_id,
          ap.shop_name, (ci.quantity * p.price) as subtotal
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        LEFT JOIN artisan_profiles ap ON p.artisan_id = ap.user_id
        WHERE ci.user_id = ?
      `).all(userId);
    } else if (sessionId) {
      return db.prepare(`
        SELECT ci.*, p.name, p.price, p.images, p.stock, p.artisan_id,
          ap.shop_name, (ci.quantity * p.price) as subtotal
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        LEFT JOIN artisan_profiles ap ON p.artisan_id = ap.user_id
        WHERE ci.session_id = ?
      `).all(sessionId);
    }
    return [];
  }

  static addItem(userId = null, sessionId = null, productId, quantity = 1) {
    const db = getDb();
    // Check if item exists
    let existing;
    if (userId) {
      existing = db.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?').get(userId, productId);
    } else {
      existing = db.prepare('SELECT * FROM cart_items WHERE session_id = ? AND product_id = ?').get(sessionId, productId);
    }

    if (existing) {
      db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
      return db.prepare('SELECT * FROM cart_items WHERE id = ?').get(existing.id);
    } else {
      const result = db.prepare(
        'INSERT INTO cart_items (user_id, session_id, product_id, quantity) VALUES (?, ?, ?, ?)'
      ).run(userId, sessionId, productId, quantity);
      return db.prepare('SELECT * FROM cart_items WHERE id = ?').get(result.lastInsertRowid);
    }
  }

  static updateItemQuantity(userId = null, sessionId = null, productId, quantity) {
    const db = getDb();
    if (quantity <= 0) {
      return this.removeItem(userId, sessionId, productId);
    }
    if (userId) {
      db.prepare('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?').run(quantity, userId, productId);
    } else {
      db.prepare('UPDATE cart_items SET quantity = ? WHERE session_id = ? AND product_id = ?').run(quantity, sessionId, productId);
    }
  }

  static removeItem(userId = null, sessionId = null, productId) {
    const db = getDb();
    if (userId) {
      return db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(userId, productId);
    } else {
      return db.prepare('DELETE FROM cart_items WHERE session_id = ? AND product_id = ?').run(sessionId, productId);
    }
  }

  static clear(userId = null, sessionId = null) {
    const db = getDb();
    if (userId) {
      return db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
    } else if (sessionId) {
      return db.prepare('DELETE FROM cart_items WHERE session_id = ?').run(sessionId);
    }
  }

  static getTotal(userId = null, sessionId = null) {
    const db = getDb();
    let result;
    if (userId) {
      result = db.prepare(`
        SELECT COALESCE(SUM(ci.quantity * p.price), 0) as total,
          COALESCE(SUM(ci.quantity), 0) as item_count
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ?
      `).get(userId);
    } else if (sessionId) {
      result = db.prepare(`
        SELECT COALESCE(SUM(ci.quantity * p.price), 0) as total,
          COALESCE(SUM(ci.quantity), 0) as item_count
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.session_id = ?
      `).get(sessionId);
    }
    return result || { total: 0, item_count: 0 };
  }

  static getCount(userId = null, sessionId = null) {
    const db = getDb();
    let result;
    if (userId) {
      result = db.prepare('SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = ?').get(userId);
    } else {
      result = db.prepare('SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE session_id = ?').get(sessionId);
    }
    return result?.count || 0;
  }

  static mergeGuestCart(userId, sessionId) {
    const db = getDb();
    const guestItems = db.prepare('SELECT * FROM cart_items WHERE session_id = ?').all(sessionId);
    
    guestItems.forEach(item => {
      const existing = db.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?').get(userId, item.product_id);
      if (existing) {
        db.prepare('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?').run(item.quantity, existing.id);
      } else {
        db.prepare('UPDATE cart_items SET user_id = ?, session_id = NULL WHERE id = ?').run(userId, item.id);
      }
    });
    
    // Clean up remaining guest items
    db.prepare('DELETE FROM cart_items WHERE session_id = ?').run(sessionId);
  }

  static validateItems(userId = null, sessionId = null) {
    const items = this.getItems(userId, sessionId);
    const issues = [];

    items.forEach(item => {
      if (item.stock < item.quantity) {
        issues.push({
          productId: item.product_id,
          name: item.name,
          requested: item.quantity,
          available: item.stock
        });
      }
    });

    return issues;
  }
}

module.exports = Cart;
