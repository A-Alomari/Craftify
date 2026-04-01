const { getDb } = require('../config/database');

class Category {
  static findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM products WHERE category_id = c.id AND status = 'approved') as product_count
      FROM categories c
      WHERE c.id = ?
    `).get(id);
  }

  static findBySlug(slug) {
    const db = getDb();
    return db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug);
  }

  static findByName(name) {
    const db = getDb();
    return db.prepare('SELECT * FROM categories WHERE name = ?').get(name);
  }

  static findAll(includeEmpty = true) {
    const db = getDb();
    let query = `
      SELECT c.*, 
        (SELECT COUNT(*) FROM products WHERE category_id = c.id AND status = 'approved') as product_count
      FROM categories c
      WHERE c.is_active = 1
    `;

    if (!includeEmpty) {
      query += " AND (SELECT COUNT(*) FROM products WHERE category_id = c.id AND status = 'approved') > 0";
    }

    query += ' ORDER BY c.name ASC';

    return db.prepare(query).all();
  }

  static create(categoryData) {
    const db = getDb();
    const { name, description = '', image = '', parent_id = null } = categoryData;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const result = db.prepare(`
      INSERT INTO categories (name, slug, description, image, parent_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, slug, description, image, parent_id);

    return this.findById(result.lastInsertRowid);
  }

  static update(id, categoryData) {
    const db = getDb();
    const fields = [];
    const params = [];

    Object.entries(categoryData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (fields.length === 0) return null;

    params.push(id);

    db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  static delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  }

  static getWithProducts(limit = 4) {
    const db = getDb();
    const categories = this.findAll(false);
    return categories.map(cat => ({
      ...cat,
      products: db.prepare(`
        SELECT p.*, 
          (SELECT AVG(rating) FROM reviews WHERE product_id = p.id AND is_approved = 1) as avg_rating
        FROM products p
        WHERE p.category_id = ? AND p.status = 'approved'
        ORDER BY p.created_at DESC
        LIMIT ?
      `).all(cat.id, limit)
    }));
  }
}

module.exports = Category;
