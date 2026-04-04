const { getDb } = require('../config/database');

class Order {
  static findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT o.*, u.name as customer_name, u.email as customer_email
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.id = ?
    `).get(id);
  }

  static findByUserId(userId, filters = {}) {
    const db = getDb();
    let query = `
      SELECT o.*, 
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      WHERE o.user_id = ?
    `;
    const params = [userId];

    if (filters.status) {
      query += ' AND o.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY o.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  static findAll(filters = {}) {
    const db = getDb();
    let query = `
      SELECT o.*, u.name as customer_name, u.email as customer_email,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ' AND o.status = ?';
      params.push(filters.status);
    }
    if (filters.payment_status) {
      query += ' AND o.payment_status = ?';
      params.push(filters.payment_status);
    }
    if (filters.user_id) {
      query += ' AND o.user_id = ?';
      params.push(filters.user_id);
    }
    if (filters.artisan_id) {
      query += ' AND o.id IN (SELECT DISTINCT oi.order_id FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE p.artisan_id = ?)';
      params.push(filters.artisan_id);
    }
    if (filters.search) {
      query += ' AND (CAST(o.id AS TEXT) = ? OR u.name LIKE ? OR u.email LIKE ?)';
      params.push(filters.search, `%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.date_from) {
      query += ' AND DATE(o.created_at) >= ?';
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      query += ' AND DATE(o.created_at) <= ?';
      params.push(filters.date_to);
    }

    query += ' ORDER BY o.created_at DESC';

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

  static create(orderData) {
    const db = getDb();
    const {
      user_id, shipping_address, shipping_city, shipping_postal, shipping_country = 'Bahrain',
      total_amount, subtotal, shipping_cost = 0, discount_amount = 0, coupon_code = null,
      payment_method, notes = ''
    } = orderData;

    const result = db.prepare(`
      INSERT INTO orders (
        user_id, shipping_address, shipping_city, shipping_postal, shipping_country,
        total_amount, subtotal, shipping_cost, discount_amount, coupon_code,
        payment_method, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      user_id, shipping_address, shipping_city, shipping_postal, shipping_country,
      total_amount, subtotal, shipping_cost, discount_amount, coupon_code,
      payment_method, notes
    );

    return this.findById(result.lastInsertRowid);
  }

  static addItem(orderId, itemData) {
    const db = getDb();
    const { product_id, artisan_id, quantity, unit_price } = itemData;
    const total_price = quantity * unit_price;

    const result = db.prepare(`
      INSERT INTO order_items (order_id, product_id, artisan_id, quantity, unit_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(orderId, product_id, artisan_id, quantity, unit_price, total_price);

    return db.prepare('SELECT * FROM order_items WHERE id = ?').get(result.lastInsertRowid);
  }

  static getItems(orderId) {
    const db = getDb();
    return db.prepare(`
      SELECT oi.*, p.name as product_name, p.images, p.artisan_id, ap.shop_name
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      LEFT JOIN artisan_profiles ap ON p.artisan_id = ap.user_id
      WHERE oi.order_id = ?
    `).all(orderId);
  }

  static getPreviewItemsForOrders(orderIds = [], limitPerOrder = 3) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return {};
    }

    const db = getDb();
    const placeholders = orderIds.map(() => '?').join(', ');
    const rows = db.prepare(`
      SELECT oi.order_id, p.name as product_name, p.images
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id IN (${placeholders})
      ORDER BY oi.order_id ASC, oi.id ASC
    `).all(...orderIds);

    const previewsByOrder = {};
    rows.forEach((row) => {
      if (!previewsByOrder[row.order_id]) {
        previewsByOrder[row.order_id] = [];
      }

      if (previewsByOrder[row.order_id].length >= limitPerOrder) {
        return;
      }

      let image = '/images/placeholder-product.jpg';
      try {
        const images = JSON.parse(row.images || '[]');
        if (Array.isArray(images) && images.length > 0) {
          image = images[0];
        }
      } catch (e) {
        image = '/images/placeholder-product.jpg';
      }

      previewsByOrder[row.order_id].push({
        product_name: row.product_name,
        image
      });
    });

    return previewsByOrder;
  }

  static getItemsByArtisan(orderId, artisanId) {
    const db = getDb();
    return db.prepare(`
      SELECT oi.*, p.name as product_name, p.images
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ? AND p.artisan_id = ?
    `).all(orderId, artisanId);
  }

  static updateStatus(id, status) {
    const db = getDb();
    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status, id);
    return this.findById(id);
  }

  static updatePaymentStatus(id, paymentStatus, transactionRef = null) {
    const db = getDb();
    db.prepare(`
      UPDATE orders SET payment_status = ?, transaction_ref = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(paymentStatus, transactionRef, id);
    return this.findById(id);
  }

  static cancel(id) {
    const db = getDb();
    db.prepare("UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(id);
    return this.findById(id);
  }

  static refund(id) {
    const db = getDb();
    db.prepare(`
      UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(id);
    return this.findById(id);
  }

  static count(filters = {}) {
    const db = getDb();
    let query = 'SELECT COUNT(*) as count FROM orders WHERE 1=1';
    const params = [];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.payment_status) {
      query += ' AND payment_status = ?';
      params.push(filters.payment_status);
    }
    if (filters.user_id) {
      query += ' AND user_id = ?';
      params.push(filters.user_id);
    }
    if (filters.artisan_id) {
      query += ' AND id IN (SELECT DISTINCT oi.order_id FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE p.artisan_id = ?)';
      params.push(filters.artisan_id);
    }

    return db.prepare(query).get(...params)?.count || 0;
  }

  static getRevenue(filters = {}) {
    const db = getDb();
    let query = "SELECT COALESCE(SUM(o.total_amount), 0) as revenue FROM orders o WHERE o.payment_status = 'paid'";
    const params = [];

    if (filters.artisan_id) {
      query = `
        SELECT COALESCE(SUM(oi.total_price), 0) as revenue
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.payment_status = 'paid' AND p.artisan_id = ?
      `;
      params.push(filters.artisan_id);
    }
    if (filters.date_from) {
      query += ' AND DATE(o.created_at) >= ?';
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      query += ' AND DATE(o.created_at) <= ?';
      params.push(filters.date_to);
    }

    return db.prepare(query).get(...params)?.revenue || 0;
  }

  static getStats() {
    return {
      total: this.count(),
      pending: this.count({ status: 'pending' }),
      confirmed: this.count({ status: 'confirmed' }),
      processing: this.count({ status: 'processing' }),
      shipped: this.count({ status: 'shipped' }),
      delivered: this.count({ status: 'delivered' }),
      cancelled: this.count({ status: 'cancelled' }),
      totalRevenue: this.getRevenue()
    };
  }

  static getRecentByArtisan(artisanId, limit = 10) {
    const db = getDb();
    return db.prepare(`
      SELECT DISTINCT o.*, u.name as customer_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE p.artisan_id = ?
      ORDER BY o.created_at DESC
      LIMIT ?
    `).all(artisanId, limit);
  }

  static getSalesDataSince(startIso) {
    const db = getDb();
    return db.prepare(`
      SELECT DATE(created_at) as date, SUM(total_amount) as revenue, COUNT(*) as orders
      FROM orders
      WHERE payment_status = 'paid' AND created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all(startIso);
  }

  static getTopProductsSince(startIso, limit = 10) {
    const db = getDb();
    return db.prepare(`
      SELECT p.name, SUM(oi.quantity) as sold, SUM(oi.total_price) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.payment_status = 'paid' AND o.created_at >= ?
      GROUP BY p.id
      ORDER BY revenue DESC
      LIMIT ?
    `).all(startIso, limit);
  }

  static getTopArtisansSince(startIso, limit = 10) {
    const db = getDb();
    return db.prepare(`
      SELECT ap.shop_name, u.name, SUM(oi.total_price) as revenue
      FROM order_items oi
      JOIN users u ON oi.artisan_id = u.id
      JOIN artisan_profiles ap ON u.id = ap.user_id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.payment_status = 'paid' AND o.created_at >= ?
      GROUP BY oi.artisan_id
      ORDER BY revenue DESC
      LIMIT ?
    `).all(startIso, limit);
  }

  static getTotalRevenueSince(startIso) {
    const db = getDb();
    const row = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM orders
      WHERE payment_status = 'paid' AND created_at >= ?
    `).get(startIso);
    return row?.total || 0;
  }

  static countSince(startIso) {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as total FROM orders WHERE created_at >= ?').get(startIso);
    return row?.total || 0;
  }

  static getMonthlyRevenueByArtisan(artisanId, months = 6) {
    const db = getDb();
    const monthsWindow = Math.max(1, parseInt(months, 10) || 6);

    return db.prepare(`
      SELECT strftime('%Y-%m', o.created_at) as month,
        SUM(oi.total_price) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE p.artisan_id = ?
        AND o.payment_status = 'paid'
        AND o.created_at >= datetime('now', ?)
      GROUP BY month
      ORDER BY month
    `).all(artisanId, `-${monthsWindow} months`);
  }

  static getTopProductsByArtisan(artisanId, limit = 5) {
    const db = getDb();
    return db.prepare(`
      SELECT p.name, SUM(oi.quantity) as sold, SUM(oi.total_price) as revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE p.artisan_id = ?
      GROUP BY p.id
      ORDER BY sold DESC
      LIMIT ?
    `).all(artisanId, limit);
  }
}

module.exports = Order;
