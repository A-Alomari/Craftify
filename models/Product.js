const { getDb } = require('../config/database');

class Product {
  static findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT p.*, c.name as category_name, 
        u.name as artisan_name, ap.shop_name,
        (SELECT AVG(rating) FROM reviews WHERE product_id = p.id AND is_approved = 1) as avg_rating,
        (SELECT COUNT(*) FROM reviews WHERE product_id = p.id AND is_approved = 1) as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.artisan_id = u.id
      LEFT JOIN artisan_profiles ap ON u.id = ap.user_id
      WHERE p.id = ?
    `).get(id);
  }

  static findAll(filters = {}) {
    const db = getDb();
    let query = `
      SELECT p.*, c.name as category_name,
        u.name as artisan_name, ap.shop_name,
        (SELECT AVG(rating) FROM reviews WHERE product_id = p.id AND is_approved = 1) as avg_rating,
        (SELECT COUNT(*) FROM reviews WHERE product_id = p.id AND is_approved = 1) as review_count
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN users u ON p.artisan_id = u.id
      LEFT JOIN artisan_profiles ap ON u.id = ap.user_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ' AND p.status = ?';
      params.push(filters.status);
    }
    if (filters.category_id) {
      query += ' AND p.category_id = ?';
      params.push(filters.category_id);
    }
    if (filters.artisan_id) {
      query += ' AND p.artisan_id = ?';
      params.push(filters.artisan_id);
    }
    if (filters.featured) {
      query += ' AND p.featured = 1';
    }
    if (filters.search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ? OR ap.shop_name LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.minPrice) {
      query += ' AND p.price >= ?';
      params.push(filters.minPrice);
    }
    if (filters.maxPrice) {
      query += ' AND p.price <= ?';
      params.push(filters.maxPrice);
    }
    if (filters.inStock) {
      query += ' AND p.stock > 0';
    }

    const sortOptions = {
      'newest': 'p.created_at DESC',
      'oldest': 'p.created_at ASC',
      'price_low': 'p.price ASC',
      'price_high': 'p.price DESC',
      'price_asc': 'p.price ASC',
      'price_desc': 'p.price DESC',
      'popular': 'p.views DESC',
      'rating': 'avg_rating DESC'
    };
    query += ` ORDER BY ${sortOptions[filters.sort] || 'p.created_at DESC'}`;

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

  static create(productData) {
    const db = getDb();
    const { artisan_id, category_id, name, description, price, images = '[]', stock = 0, status = 'pending', featured = 0 } = productData;

    const result = db.prepare(`
      INSERT INTO products (artisan_id, category_id, name, description, price, images, stock, status, featured)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(artisan_id, category_id, name, description, price, images, stock, status, featured);

    return this.findById(result.lastInsertRowid);
  }

  static update(id, productData) {
    const db = getDb();
    const fields = [];
    const params = [];

    // Whitelist allowed columns to prevent unintended updates
    const allowedColumns = [
      'name', 'description', 'price', 'images', 'stock',
      'category_id', 'status', 'featured', 'artisan_id'
    ];

    Object.entries(productData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && allowedColumns.includes(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  static delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }

  static incrementViews(id) {
    const db = getDb();
    db.prepare('UPDATE products SET views = views + 1 WHERE id = ?').run(id);
  }

  static updateStock(id, quantity) {
    const db = getDb();
    return db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(quantity, id);
  }

  static decreaseStock(id, quantity) {
    const db = getDb();
    return db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?').run(quantity, id, quantity);
  }

  static getFeatured(limit = 8) {
    return this.findAll({ status: 'approved', featured: true, limit });
  }

  static getNewArrivals(limit = 8) {
    return this.findAll({ status: 'approved', sort: 'newest', limit });
  }

  static getPopular(limit = 8) {
    return this.findAll({ status: 'approved', sort: 'popular', limit });
  }

  static getByArtisan(artisanId, filters = {}) {
    return this.findAll({ ...filters, artisan_id: artisanId });
  }

  static getRelated(productId, limit = 4) {
    const db = getDb();
    const product = this.findById(productId);
    if (!product) return [];

    return db.prepare(`
      SELECT p.*, c.name as category_name,
        (SELECT AVG(rating) FROM reviews WHERE product_id = p.id) as avg_rating
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id != ? AND p.status = 'approved'
        AND (p.category_id = ? OR p.artisan_id = ?)
      ORDER BY RANDOM()
      LIMIT ?
    `).all(productId, product.category_id, product.artisan_id, limit);
  }

  static count(filters = {}) {
    const db = getDb();
    let query = `
      SELECT COUNT(DISTINCT p.id) as count
      FROM products p
      LEFT JOIN artisan_profiles ap ON p.artisan_id = ap.user_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ' AND p.status = ?';
      params.push(filters.status);
    }
    if (filters.artisan_id) {
      query += ' AND p.artisan_id = ?';
      params.push(filters.artisan_id);
    }
    if (filters.category_id) {
      query += ' AND p.category_id = ?';
      params.push(filters.category_id);
    }
    if (filters.featured) {
      query += ' AND p.featured = 1';
    }
    if (filters.search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ? OR ap.shop_name LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.minPrice) {
      query += ' AND p.price >= ?';
      params.push(filters.minPrice);
    }
    if (filters.maxPrice) {
      query += ' AND p.price <= ?';
      params.push(filters.maxPrice);
    }
    if (filters.inStock) {
      query += ' AND p.stock > 0';
    }

    return db.prepare(query).get(...params)?.count || 0;
  }

  static getStats() {
    return {
      total: this.count(),
      approved: this.count({ status: 'approved' }),
      pending: this.count({ status: 'pending' }),
      rejected: this.count({ status: 'rejected' })
    };
  }
}

module.exports = Product;
