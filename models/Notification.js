const { getDb } = require('../config/database');

class Notification {
  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  }

  static findByUserId(userId, filters = {}) {
    const db = getDb();
    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (filters.unread) {
      query += ' AND is_read = 0';
    }
    if (filters.type) {
      query += ' AND type = ?';
      params.push(filters.type);
    }

    query += ' ORDER BY created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  static create(notificationData) {
    const db = getDb();
    const { user_id, title, message, type = 'general', link = null } = notificationData;

    const result = db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (?, ?, ?, ?, ?)
    `).run(user_id, title, message, type, link);

    return this.findById(result.lastInsertRowid);
  }

  static markAsRead(id) {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
    return this.findById(id);
  }

  static markAllAsRead(userId) {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(userId);
  }

  static delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM notifications WHERE id = ?').run(id);
  }

  static deleteAll(userId) {
    const db = getDb();
    return db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
  }

  static getUnreadCount(userId) {
    const db = getDb();
    const result = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(userId);
    return result?.count || 0;
  }

  // Helper methods
  static orderPlaced(userId, orderId) {
    return this.create({ user_id: userId, title: 'Order Placed', message: `Your order #${orderId} has been placed successfully!`, type: 'order', link: `/orders/${orderId}` });
  }

  static orderStatusChanged(userId, orderId, status) {
    return this.create({ user_id: userId, title: 'Order Update', message: `Your order #${orderId} status has been updated to ${status}`, type: 'order', link: `/orders/${orderId}` });
  }

  static newOrderForArtisan(artisanId, orderId) {
    return this.create({ user_id: artisanId, title: 'New Order Received', message: `You have received a new order #${orderId}`, type: 'order', link: `/artisan/orders/${orderId}` });
  }

  static auctionOutbid(userId, auctionId, auctionTitle) {
    return this.create({ user_id: userId, title: "You've been outbid!", message: `Someone placed a higher bid on "${auctionTitle}"`, type: 'auction', link: `/auctions/${auctionId}` });
  }

  static auctionWon(userId, auctionId, auctionTitle, amount) {
    return this.create({ user_id: userId, title: 'Congratulations! You won!', message: `You won the auction for "${auctionTitle}" with a bid of $${amount}`, type: 'auction', link: `/auctions/${auctionId}` });
  }

  static auctionEnded(artisanId, auctionId, auctionTitle, hasBids) {
    return this.create({ user_id: artisanId, title: 'Auction Ended', message: hasBids ? `Your auction "${auctionTitle}" has ended with a winning bid` : `Your auction "${auctionTitle}" ended with no bids`, type: 'auction', link: `/artisan/auctions/${auctionId}` });
  }

  static newReview(artisanId, productName, rating) {
    return this.create({ user_id: artisanId, title: 'New Review', message: `Your product "${productName}" received a ${rating}-star review`, type: 'review' });
  }

  static newMessage(userId, senderName) {
    return this.create({ user_id: userId, title: 'New Message', message: `You have a new message from ${senderName}`, type: 'message', link: '/user/messages' });
  }

  static productApproved(artisanId, productName) {
    return this.create({ user_id: artisanId, title: 'Product Approved', message: `Your product "${productName}" has been approved and is now live!`, type: 'system' });
  }

  static productRejected(artisanId, productName) {
    return this.create({ user_id: artisanId, title: 'Product Rejected', message: `Your product "${productName}" was not approved. Please review our guidelines.`, type: 'system' });
  }

  static artisanApproved(userId) {
    return this.create({ user_id: userId, title: 'Account Approved!', message: 'Your artisan account has been approved. You can now start selling!', type: 'system', link: '/artisan/dashboard' });
  }
}

module.exports = Notification;
