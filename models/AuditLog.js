const { getDb } = require('../config/database');

// Human-readable labels for action codes
const ACTION_LABELS = {
  approve_artisan:       'Approved Artisan',
  reject_artisan:        'Rejected Artisan',
  approve_product:       'Approved Product',
  reject_product:        'Rejected Product',
  delete_product:        'Deleted Product',
  toggle_featured:       'Toggled Featured Product',
  approve_auction:       'Approved Auction',
  reject_auction:        'Rejected Auction',
  cancel_auction:        'Cancelled Auction',
  update_order_status:   'Updated Order Status',
  delete_user:           'Deleted User',
  update_user_status:    'Updated User Status',
  approve_review:        'Approved Review',
  delete_review:         'Deleted Review',
  create_coupon:         'Created Coupon',
  delete_coupon:         'Deleted Coupon',
  update_settings:       'Updated Platform Settings',
  change_password:       'Changed Admin Password',
};

class AuditLog {
  static record(adminId, adminName, action, entityType, entityId, detail, ipAddress) {
    try {
      const db = getDb();
      db.prepare(
        `INSERT INTO admin_audit_log
           (admin_id, admin_name, action, entity_type, entity_id, detail, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        adminId,
        adminName || null,
        action,
        entityType || null,
        entityId || null,
        detail ? JSON.stringify(detail) : null,
        ipAddress || null
      );
    } catch (err) {
      // Audit failure is non-fatal — log but don't crash the request
      console.error('AuditLog.record error:', err.message);
    }
  }

  static findRecent(limit = 50) {
    const db = getDb();
    const rows = db.prepare(
      `SELECT * FROM admin_audit_log ORDER BY created_at DESC LIMIT ?`
    ).all(limit);
    return rows.map(r => ({
      ...r,
      action_label: ACTION_LABELS[r.action] || r.action,
      detail_text: r.detail ? (() => {
        try {
          const d = JSON.parse(r.detail);
          return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(' · ');
        } catch (e) { return r.detail; }
      })() : null,
    }));
  }

  static findAll(filters = {}) {
    const db = getDb();
    let query = 'SELECT * FROM admin_audit_log WHERE 1=1';
    const params = [];
    if (filters.action) { query += ' AND action = ?'; params.push(filters.action); }
    if (filters.admin_id) { query += ' AND admin_id = ?'; params.push(filters.admin_id); }
    query += ' ORDER BY created_at DESC';
    if (filters.limit) { query += ' LIMIT ?'; params.push(filters.limit); }
    if (filters.offset) { query += ' OFFSET ?'; params.push(filters.offset); }
    const rows = db.prepare(query).all(...params);
    return rows.map(r => ({
      ...r,
      action_label: ACTION_LABELS[r.action] || r.action,
      detail_text: r.detail ? (() => {
        try {
          const d = JSON.parse(r.detail);
          return Object.entries(d).map(([k, v]) => `${k}: ${v}`).join(' · ');
        } catch (e) { return r.detail; }
      })() : null,
    }));
  }

  static count(filters = {}) {
    const db = getDb();
    let query = 'SELECT COUNT(*) as total FROM admin_audit_log WHERE 1=1';
    const params = [];
    if (filters.action) { query += ' AND action = ?'; params.push(filters.action); }
    if (filters.admin_id) { query += ' AND admin_id = ?'; params.push(filters.admin_id); }
    const row = db.prepare(query).get(...params);
    return row ? row.total : 0;
  }
}

module.exports = AuditLog;
AuditLog.ACTION_LABELS = ACTION_LABELS;
