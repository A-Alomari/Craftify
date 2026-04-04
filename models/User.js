const { getDb } = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static normalizePhone(phone) {
    if (!phone) return '';
    return String(phone).trim().replace(/[\s().-]/g, '');
  }

  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  static findByEmail(email) {
    const db = getDb();
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  }

  static findByPhone(phone) {
    const db = getDb();
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) return undefined;

    const normalizedPhoneNoPlus = normalizedPhone.replace(/^\+/, '');
    return db.prepare(`
      SELECT * FROM users
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?
         OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') = ?
      LIMIT 1
    `).get(normalizedPhone, normalizedPhoneNoPlus);
  }

  static findByIdentifier(identifier) {
    const value = String(identifier || '').trim();
    if (!value) return undefined;

    if (value.includes('@')) {
      return this.findByEmail(value);
    }

    return this.findByPhone(value) || this.findByEmail(value);
  }

  static findAll(filters = {}) {
    const db = getDb();
    let query = 'SELECT * FROM users WHERE 1=1';
    const params = [];

    if (filters.role) {
      query += ' AND role = ?';
      params.push(filters.role);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.search) {
      query += ' AND (name LIKE ? OR email LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    query += ' ORDER BY created_at DESC';

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

  static async create(userData) {
    const db = getDb();
    const { email, password, name, role = 'customer', shipping_address = '', phone = '' } = userData;
    
    // Check if email exists
    const existing = this.findByEmail(email);
    if (existing) {
      throw new Error('Email already registered');
    }

    // Hash password (cost factor 12 per OWASP recommendation)
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = db.prepare(`
      INSERT INTO users (email, password, name, role, shipping_address, phone)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(email.toLowerCase(), hashedPassword, name, role, shipping_address, phone);

    return this.findById(result.lastInsertRowid);
  }

  static async verifyPassword(identifier, password) {
    const user = this.findByIdentifier(identifier);
    if (!user) return null;

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    return user;
  }

  static update(id, userData) {
    const db = getDb();
    const fields = [];
    const params = [];

    const allowedColumns = [
      'name', 'email', 'role', 'status', 'phone', 'avatar',
      'shipping_address', 'city', 'postal_code', 'country', 'dob'
    ];

    Object.entries(userData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && key !== 'password' && allowedColumns.includes(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    });

    if (fields.length === 0) return null;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  static async updatePassword(id, newPassword) {
    const db = getDb();
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, id);
    return true;
  }

  static updateStatus(id, status) {
    const db = getDb();
    db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(status, id);
    return this.findById(id);
  }

  static delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  static count(filters = {}) {
    const db = getDb();
    let query = 'SELECT COUNT(*) as count FROM users WHERE 1=1';
    const params = [];

    if (filters.role) {
      query += ' AND role = ?';
      params.push(filters.role);
    }
    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    return db.prepare(query).get(...params)?.count || 0;
  }

  static getStats() {
    return {
      total: this.count(),
      customers: this.count({ role: 'customer' }),
      artisans: this.count({ role: 'artisan' }),
      admins: this.count({ role: 'admin' }),
      active: this.count({ status: 'active' }),
      suspended: this.count({ status: 'suspended' })
    };
  }
}

module.exports = User;
