const { getDb } = require('../config/database');
const { sanitizeString, sanitizeText } = require('../utils/sanitizer');

class Message {
  static findById(id) {
    const db = getDb();
    return db.prepare(`
      SELECT m.*, 
        s.name as sender_name, s.avatar as sender_avatar, s.role as sender_role,
        r.name as receiver_name, r.avatar as receiver_avatar
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      JOIN users r ON m.receiver_id = r.id
      WHERE m.id = ?
    `).get(id);
  }

  static getConversations(userId) {
    const db = getDb();
    return db.prepare(`
      SELECT 
        CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as other_user_id,
        u.name as other_user_name,
        u.avatar as other_user_avatar,
        u.role as other_user_role,
        ap.shop_name,
        (SELECT content FROM messages 
         WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
         ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT created_at FROM messages 
         WHERE (sender_id = ? AND receiver_id = u.id) OR (sender_id = u.id AND receiver_id = ?)
         ORDER BY created_at DESC LIMIT 1) as last_message_time,
        (SELECT COUNT(*) FROM messages 
         WHERE sender_id = u.id AND receiver_id = ? AND is_read = 0) as unread_count
      FROM messages m
      JOIN users u ON (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END) = u.id
      LEFT JOIN artisan_profiles ap ON u.id = ap.user_id
      WHERE m.sender_id = ? OR m.receiver_id = ?
      GROUP BY other_user_id
      ORDER BY last_message_time DESC
    `).all(userId, userId, userId, userId, userId, userId, userId, userId, userId);
  }

  static getThread(userId, otherUserId) {
    const db = getDb();
    return db.prepare(`
      SELECT m.*, 
        s.name as sender_name, s.avatar as sender_avatar
      FROM messages m
      JOIN users s ON m.sender_id = s.id
      WHERE (m.sender_id = ? AND m.receiver_id = ?) 
         OR (m.sender_id = ? AND m.receiver_id = ?)
      ORDER BY m.created_at ASC
    `).all(userId, otherUserId, otherUserId, userId);
  }

  static create(messageData) {
    const db = getDb();
    const { sender_id, receiver_id, subject = null, content, parent_id = null, image_url = null } = messageData;
    const normalizedSubject = subject === null ? null : sanitizeString(subject);
    const normalizedContent = sanitizeText(content);

    if (!normalizedContent && !image_url) {
      throw new Error('Message content is required');
    }
    if (normalizedContent && normalizedContent.length > 2000) {
      throw new Error('Message must be at most 2000 characters');
    }
    if (normalizedSubject && normalizedSubject.length > 200) {
      throw new Error('Message subject must be at most 200 characters');
    }

    const result = db.prepare(`
      INSERT INTO messages (sender_id, receiver_id, subject, content, parent_id, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sender_id, receiver_id, normalizedSubject, normalizedContent || '', parent_id, image_url);

    return this.findById(result.lastInsertRowid);
  }

  static hasRecentDuplicate(senderId, receiverId, content, withinSeconds = 10) {
    const db = getDb();
    const safeWindow = Math.max(Number.parseInt(withinSeconds, 10) || 0, 1);
    const normalizedContent = sanitizeText(content);
    if (!normalizedContent) {
      return false;
    }

    const existing = db.prepare(`
      SELECT id
      FROM messages
      WHERE sender_id = ?
        AND receiver_id = ?
        AND content = ?
        AND created_at >= datetime('now', ?)
      ORDER BY id DESC
      LIMIT 1
    `).get(senderId, receiverId, normalizedContent, `-${safeWindow} seconds`);

    return Boolean(existing);
  }

  static markAsRead(id) {
    const db = getDb();
    db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(id);
  }

  static markThreadAsRead(userId, otherUserId) {
    const db = getDb();
    db.prepare(`
      UPDATE messages SET is_read = 1 
      WHERE sender_id = ? AND receiver_id = ?
    `).run(otherUserId, userId);
  }

  static getUnreadCount(userId) {
    const db = getDb();
    const result = db.prepare(
      'SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0'
    ).get(userId);
    return result?.count || 0;
  }

  static delete(id) {
    const db = getDb();
    return db.prepare('DELETE FROM messages WHERE id = ?').run(id);
  }
}

module.exports = Message;
