const { getDb } = require('../config/database');

class NewsletterSubscription {
  static subscribe(email) {
    const db = getDb();
    return db.prepare('INSERT OR IGNORE INTO newsletter_subscriptions (email) VALUES (?)').run(email);
  }

  static findAll() {
    const db = getDb();
    return db.prepare('SELECT * FROM newsletter_subscriptions ORDER BY created_at DESC').all();
  }

  static count() {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) AS total FROM newsletter_subscriptions').get();
    return row ? (row.total || 0) : 0;
  }

  static unsubscribe(email) {
    const db = getDb();
    return db.prepare('DELETE FROM newsletter_subscriptions WHERE email = ?').run(email);
  }
}

module.exports = NewsletterSubscription;
