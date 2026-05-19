const { getDb } = require('../config/database');

const DEFAULTS = {
  // General
  display_timezone:         'Asia/Bahrain',
  // Commerce
  commission_rate:          '10',
  tax_rate:                 '0',
  default_shipping_cost:    '3',
  free_shipping_threshold:  '50',
  supported_currencies:     'BHD',
  // Auctions
  max_auction_days:         '30',
  auction_listing_fee:      '0',
  // Email
  email_sender_name:        'Craftify',
  email_sender_address:     'noreply@craftify.local',
};

class SiteSetting {
  /** Returns all settings as a flat key→value object with defaults filled in. */
  static getAll() {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM platform_settings').all();
    const out = { ...DEFAULTS };
    rows.forEach(r => { out[r.key] = r.value; });
    return out;
  }

  static get(key) {
    const db = getDb();
    const row = db.prepare('SELECT value FROM platform_settings WHERE key = ?').get(key);
    return row ? row.value : (DEFAULTS[key] ?? null);
  }

  static set(key, value) {
    const db = getDb();
    db.prepare(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    ).run(key, String(value ?? ''));
  }

  /**
   * Bulk-update settings from a key→value plain object.
   * Only known DEFAULTS keys are accepted to prevent arbitrary writes.
   */
  static bulkSet(data = {}) {
    const db = getDb();
    const stmt = db.prepare(
      `INSERT INTO platform_settings (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    );
    const allowed = new Set(Object.keys(DEFAULTS));
    for (const [key, value] of Object.entries(data)) {
      if (allowed.has(key)) {
        stmt.run(key, String(value ?? ''));
      }
    }
  }

  static getDefaults() {
    return { ...DEFAULTS };
  }
}

module.exports = SiteSetting;
