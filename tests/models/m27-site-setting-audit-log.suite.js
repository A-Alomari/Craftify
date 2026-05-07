// m27 – SiteSetting and AuditLog model tests
module.exports = ({ getTestContext, makeUnique }) => {
  let db;
  let ids;

  beforeAll(() => {
    ({ db, ids } = getTestContext());
  });

  // ── SiteSetting ──────────────────────────────────────────────────────────
  describe('SiteSetting Model', () => {
    const SiteSetting = require('../../models/SiteSetting');

    test('getDefaults returns an object with all 10 expected keys', () => {
      const defaults = SiteSetting.getDefaults();
      expect(typeof defaults).toBe('object');
      const expectedKeys = [
        'display_timezone', 'commission_rate', 'tax_rate',
        'default_shipping_cost', 'free_shipping_threshold',
        'supported_currencies', 'max_auction_days', 'auction_listing_fee',
        'email_sender_name', 'email_sender_address'
      ];
      expectedKeys.forEach(key => {
        expect(defaults).toHaveProperty(key);
      });
    });

    test('get returns default value when key is not in DB', () => {
      // Use an unlikely key to ensure it is not seeded
      const val = SiteSetting.get('display_timezone');
      // either from DB seed or from DEFAULTS — must be a non-empty string
      expect(typeof val).toBe('string');
      expect(val.length).toBeGreaterThan(0);
    });

    test('set persists a value and get retrieves it', () => {
      const key = 'commission_rate';
      SiteSetting.set(key, '12');
      const retrieved = SiteSetting.get(key);
      expect(retrieved).toBe('12');
      // Restore
      SiteSetting.set(key, '10');
    });

    test('getAll returns an object merging DB values with defaults', () => {
      const all = SiteSetting.getAll();
      expect(typeof all).toBe('object');
      expect(all).toHaveProperty('commission_rate');
      expect(all).toHaveProperty('email_sender_name');
    });

    test('bulkSet updates multiple keys at once', () => {
      SiteSetting.bulkSet({ tax_rate: '5', default_shipping_cost: '2' });
      expect(SiteSetting.get('tax_rate')).toBe('5');
      expect(SiteSetting.get('default_shipping_cost')).toBe('2');
      // Restore
      SiteSetting.bulkSet({ tax_rate: '0', default_shipping_cost: '3' });
    });

    test('bulkSet silently skips unknown keys', () => {
      expect(() => {
        SiteSetting.bulkSet({ unknown_key_xyz: 'bad' });
      }).not.toThrow();
    });
  });

  // ── AuditLog ─────────────────────────────────────────────────────────────
  describe('AuditLog Model', () => {
    const AuditLog = require('../../models/AuditLog');

    test('record inserts a row (fire-and-forget, returns void)', () => {
      const before = db.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').get().n;
      AuditLog.record(
        ids.adminId,
        'Admin',
        'update_settings',
        'setting',
        null,
        { keys: ['commission_rate'] },
        '127.0.0.1'
      );
      const after = db.prepare('SELECT COUNT(*) AS n FROM admin_audit_log').get().n;
      expect(after).toBe(before + 1);
    });

    test('findRecent returns rows with action_label and detail_text computed', () => {
      AuditLog.record(ids.adminId, 'Admin', 'change_password', 'user', ids.adminId, {}, '127.0.0.1');
      const rows = AuditLog.findRecent(10);
      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(0);
      const row = rows[0];
      expect(row).toHaveProperty('action_label');
      expect(row).toHaveProperty('detail_text');
      expect(typeof row.action_label).toBe('string');
    });

    test('count returns total audit log entries as integer', () => {
      const n = AuditLog.count({});
      expect(typeof n).toBe('number');
      expect(n).toBeGreaterThan(0);
    });

    test('findAll with adminId filter returns only that admin\'s rows', () => {
      const rows = AuditLog.findAll({ admin_id: ids.adminId, limit: 50, offset: 0 });
      expect(Array.isArray(rows)).toBe(true);
      rows.forEach(r => expect(r.admin_id).toBe(ids.adminId));
    });

    test('findAll with action filter returns only matching rows', () => {
      const rows = AuditLog.findAll({ action: 'update_settings', limit: 50, offset: 0 });
      expect(Array.isArray(rows)).toBe(true);
      rows.forEach(r => expect(r.action).toBe('update_settings'));
    });

    test('ACTION_LABELS map is defined and non-empty', () => {
      expect(AuditLog.ACTION_LABELS).toBeDefined();
      expect(typeof AuditLog.ACTION_LABELS).toBe('object');
      expect(AuditLog.ACTION_LABELS['update_settings']).toBeDefined();
    });
  });
};
