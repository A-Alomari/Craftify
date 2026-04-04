const { getDb } = require('../config/database');

class NewsletterSubscription {
  static subscribe(email) {
    const db = getDb();
    return db.prepare('INSERT OR IGNORE INTO newsletter_subscriptions (email) VALUES (?)').run(email);
  }
}

module.exports = NewsletterSubscription;
