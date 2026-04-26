const { getDb } = require('../config/database');

class Coupon {
  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
  }

  static findByCode(code) {
    const db = getDb();
    return db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').get(code.toUpperCase());
  }

  static findAll(filters = {}) {
    const db = getDb();
    let query = `
      SELECT c.*, ap.shop_name as artisan_shop_name, u.name as artisan_name
      FROM coupons c
      LEFT JOIN artisan_profiles ap ON c.artisan_id = ap.user_id
      LEFT JOIN users u ON c.artisan_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.active !== undefined) {
      query += ' AND c.is_active = ?';
      params.push(filters.active ? 1 : 0);
    }
    if (filters.scope) {
      query += ' AND c.scope = ?';
      params.push(filters.scope);
    }
    if (filters.artisan_id) {
      query += ' AND c.artisan_id = ?';
      params.push(filters.artisan_id);
    }
    if (filters.created_by) {
      query += ' AND c.created_by = ?';
      params.push(filters.created_by);
    }

    query += ' ORDER BY c.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  static create(couponData) {
    const db = getDb();
    const {
      code, description = '', discount_type = 'percent', discount_value,
      min_purchase = 0, max_discount = null, valid_from = null,
      valid_until = null, usage_limit = null,
      scope = 'global', artisan_id = null, created_by = null
    } = couponData;

    const result = db.prepare(`
      INSERT INTO coupons (
        code, description, type, discount_type, value, discount_value,
        min_order, min_purchase, max_discount, max_uses, usage_limit,
        valid_from, valid_until, scope, artisan_id, created_by, is_active, active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)
    `).run(
      code.toUpperCase(), description, discount_type, discount_type,
      discount_value, discount_value,
      min_purchase, min_purchase, max_discount, usage_limit, usage_limit,
      valid_from, valid_until, scope, artisan_id, created_by
    );

    return this.findById(result.lastInsertRowid);
  }

  static update(id, couponData) {
    const db = getDb();
    const fields = [];
    const params = [];

    const allowedColumns = [
      'code', 'description', 'type', 'discount_type', 'value', 'discount_value',
      'min_order', 'min_purchase', 'max_discount', 'max_uses', 'usage_limit',
      'used_count', 'times_used', 'is_active', 'active', 'valid_from', 'valid_until', 'expires_at',
      'scope', 'artisan_id', 'created_by'
    ];

    Object.entries(couponData).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id' && allowedColumns.includes(key)) {
        fields.push(`${key} = ?`);
        params.push(key === 'code' ? value.toUpperCase() : value);
      }
    });

    if (fields.length === 0) return null;

    params.push(id);

    db.prepare(`UPDATE coupons SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    return this.findById(id);
  }

  static delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
  }

  static getScope(coupon) {
    if (coupon.scope) return coupon.scope;
    if (coupon.artisan_id) return 'artisan';
    return 'global';
  }

  static getCartTotalFromItems(cartItems = []) {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return 0;
    }

    return cartItems.reduce((sum, item) => {
      const quantity = Number.parseInt(item.quantity, 10) || 0;
      const price = Number.parseFloat(item.price || item.unit_price) || 0;
      return sum + (quantity * price);
    }, 0);
  }

  static getEligibleTotal(coupon, cartItems = [], fallbackTotal = 0) {
    const scope = this.getScope(coupon);
    if (scope !== 'artisan' || !coupon.artisan_id) {
      return Number.isFinite(fallbackTotal) ? fallbackTotal : this.getCartTotalFromItems(cartItems);
    }

    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return 0;
    }

    const targetArtisanId = Number.parseInt(coupon.artisan_id, 10);
    return cartItems.reduce((sum, item) => {
      const itemArtisanId = Number.parseInt(item.artisan_id, 10);
      if (!Number.isInteger(targetArtisanId) || itemArtisanId !== targetArtisanId) {
        return sum;
      }

      const quantity = Number.parseInt(item.quantity, 10) || 0;
      const price = Number.parseFloat(item.price || item.unit_price) || 0;
      return sum + (quantity * price);
    }, 0);
  }

  static validate(code, cartTotal, cartItems = []) {
    const coupon = this.findByCode(code);
    if (!coupon) {
      return { valid: false, error: 'Invalid coupon code' };
    }

    const now = new Date();
    const validFrom = coupon.valid_from;
    const validUntil = coupon.valid_until || coupon.expires_at;
    
    if (validFrom && new Date(validFrom) > now) {
      return { valid: false, error: 'Coupon is not yet active' };
    }
    if (validUntil && new Date(validUntil) < now) {
      return { valid: false, error: 'Coupon has expired' };
    }
    
    const usageLimit = coupon.usage_limit || coupon.max_uses;
    const timesUsed = coupon.times_used || coupon.used_count || 0;
    if (usageLimit && timesUsed >= usageLimit) {
      return { valid: false, error: 'Coupon usage limit reached' };
    }

    const eligibleTotal = this.getEligibleTotal(coupon, cartItems, cartTotal);
    if (this.getScope(coupon) === 'artisan' && eligibleTotal <= 0) {
      return { valid: false, error: 'This promo code applies only to the artisan shop that created it' };
    }
    
    const minPurchase = coupon.min_purchase || coupon.min_order || 0;
    if (eligibleTotal < minPurchase) {
      return { valid: false, error: `Minimum purchase of $${minPurchase} required` };
    }

    // Calculate discount
    const discountType = coupon.discount_type || coupon.type;
    const discountValue = coupon.discount_value || coupon.value;
    let discount;
    if (discountType === 'percent' || discountType === 'percentage') {
      discount = eligibleTotal * (discountValue / 100);
      if (coupon.max_discount && discount > coupon.max_discount) {
        discount = coupon.max_discount;
      }
    } else {
      discount = discountValue;
    }

    return {
      valid: true,
      coupon,
      discount: Math.min(discount, eligibleTotal),
      eligibleTotal
    };
  }

  static validateForCart(code, cartItems = []) {
    const cartTotal = this.getCartTotalFromItems(cartItems);
    return this.validate(code, cartTotal, cartItems);
  }

  static use(code) {
    const db = getDb();
    db.prepare('UPDATE coupons SET times_used = COALESCE(times_used, 0) + 1, used_count = COALESCE(used_count, 0) + 1 WHERE code = ?')
      .run(code.toUpperCase());
  }

  static toggleActive(id) {
    const db = getDb();
    const coupon = this.findById(id);
    if (!coupon) return null;

    const newActive = coupon.is_active ? 0 : 1;
    db.prepare('UPDATE coupons SET is_active = ?, active = ? WHERE id = ?')
      .run(newActive, newActive, id);
    return this.findById(id);
  }
}

module.exports = Coupon;
