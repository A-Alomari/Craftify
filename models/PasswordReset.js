const { getDb } = require('../config/database');

class PasswordReset {
  static create({ user_id, token, expires_at }) {
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO password_resets (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `).run(user_id, token, expires_at);

    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM password_resets WHERE id = ?').get(id);
  }

  static findValidByToken(token, nowIso) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM password_resets
      WHERE token = ? AND used = 0 AND expires_at > ?
    `).get(token, nowIso);
  }

  static findValidByLegacyToken(token, nowIso) {
    const db = getDb();
    return db.prepare(`
      SELECT * FROM password_resets
      WHERE token = ? AND used = 0 AND expires_at > ? AND token NOT LIKE 'sha256:%'
    `).get(token, nowIso);
  }

  static markUsed(id) {
    const db = getDb();
    return db.prepare('UPDATE password_resets SET used = 1 WHERE id = ?').run(id);
  }
}

module.exports = PasswordReset;
