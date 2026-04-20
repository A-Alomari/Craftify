const { getDb } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Shipment {
  static findById(id) {
    const db = getDb();
    return db.prepare('SELECT * FROM shipments WHERE id = ?').get(id);
  }

  static findByOrderId(orderId) {
    const db = getDb();
    return db.prepare('SELECT * FROM shipments WHERE order_id = ?').get(orderId);
  }

  static findByTrackingNumber(trackingNumber) {
    const db = getDb();
    return db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(trackingNumber);
  }

  static findAll(filters = {}) {
    const db = getDb();
    let query = `
      SELECT s.*, o.user_id, u.name as customer_name
      FROM shipments s
      JOIN orders o ON s.order_id = o.id
      JOIN users u ON o.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (filters.status) {
      query += ' AND s.status = ?';
      params.push(filters.status);
    }
    if (filters.order_id) {
      query += ' AND s.order_id = ?';
      params.push(filters.order_id);
    }

    query += ' ORDER BY s.created_at DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  static create(orderId) {
    const db = getDb();
    const trackingNumber = 'CRF' + uuidv4().replace(/-/g, '').substring(0, 12).toUpperCase();
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + Math.floor(Math.random() * 5) + 3);

    const history = [{
      status: 'pending',
      timestamp: new Date().toISOString(),
      location: 'Order received'
    }];

    const result = db.prepare(`
      INSERT INTO shipments (order_id, tracking_number, estimated_delivery, history)
      VALUES (?, ?, ?, ?)
    `).run(orderId, trackingNumber, estimatedDelivery.toISOString().split('T')[0], JSON.stringify(history));

    return this.findById(result.lastInsertRowid);
  }

  static updateStatus(id, status, location = '') {
    const db = getDb();
    const shipment = this.findById(id);
    if (!shipment) return null;

    const history = JSON.parse(shipment.history || '[]');
    history.push({
      status,
      timestamp: new Date().toISOString(),
      location
    });

    let sql = 'UPDATE shipments SET status = ?, history = ?, last_update = ?, updated_at = CURRENT_TIMESTAMP';
    const params = [status, JSON.stringify(history), new Date().toISOString()];

    if (status === 'shipped') {
      sql += ', shipped_at = ?';
      params.push(new Date().toISOString());
    }
    if (status === 'delivered') {
      sql += ', delivered_at = ?';
      params.push(new Date().toISOString());
    }

    sql += ' WHERE id = ?';
    params.push(id);

    db.prepare(sql).run(...params);
    return this.findById(id);
  }

  static getHistory(id) {
    const shipment = this.findById(id);
    if (!shipment) return [];
    return JSON.parse(shipment.history || '[]');
  }

  static getByUserId(userId) {
    const db = getDb();
    return db.prepare(`
      SELECT s.*, o.id as order_id, o.total_amount
      FROM shipments s
      JOIN orders o ON s.order_id = o.id
      WHERE o.user_id = ?
      ORDER BY s.created_at DESC
    `).all(userId);
  }

  // WHY: Background shipment simulation belongs in the model — not in server.js.
  // io is injected so the method can emit socket events without importing server.js.
  static advanceAll(io) {
    const db = getDb();
    const statusFlow = ['pending', 'processing', 'shipped', 'in_transit', 'delivered'];
    const locations = [
      'Manama Sorting Center', 'Riffa Distribution Hub', 'Muharraq Warehouse',
      'Isa Town Depot', 'Hamad Town Facility', 'Local Delivery Station', 'Out for Delivery'
    ];
    const randomLocation = () => locations[Math.floor(Math.random() * locations.length)];

    const shipments = db.prepare(
      "SELECT * FROM shipments WHERE status NOT IN ('delivered', 'failed')"
    ).all();

    shipments.forEach(shipment => {
      const currentIndex = statusFlow.indexOf(shipment.status);
      if (currentIndex < statusFlow.length - 1 && Math.random() > 0.7) {
        const newStatus = statusFlow[currentIndex + 1];
        const history = JSON.parse(shipment.history || '[]');
        history.push({ status: newStatus, timestamp: new Date().toISOString(), location: randomLocation() });

        db.prepare(
          'UPDATE shipments SET status = ?, history = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).run(newStatus, JSON.stringify(history), shipment.id);

        if (newStatus === 'shipped' || newStatus === 'delivered') {
          db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, shipment.order_id);
        }

        const order = db.prepare('SELECT user_id FROM orders WHERE id = ?').get(shipment.order_id);
        if (order) {
          // Deduplicate: remove previous Shipment Update notification for same order
          db.prepare(
            "DELETE FROM notifications WHERE user_id = ? AND title = 'Shipment Update' AND link LIKE ?"
          ).run(order.user_id, `/orders/${shipment.order_id}%`);
          db.prepare(
            "INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, 'order', ?)"
          ).run(
            order.user_id,
            'Shipment Update',
            `Your order #${shipment.order_id} is now ${newStatus.replace('_', ' ')}`,
            `/orders/${shipment.order_id}/track`
          );
        }
      }
    });
  }
}

module.exports = Shipment;
