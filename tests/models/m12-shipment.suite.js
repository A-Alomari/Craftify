module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Shipment Model', () => {
    const Shipment = require('../../models/Shipment');

    test('create/find/update status/history methods work', () => {
      const newOrder = db.prepare(`
        INSERT INTO orders (
          user_id, subtotal, shipping_cost, discount_amount, total_amount,
          status, payment_method, payment_status, shipping_address, shipping_city, shipping_country
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(ids.custId, 20, 5, 0, 25, 'confirmed', 'card', 'paid', 'Addr', 'Manama', 'Bahrain');

      const shipment = Shipment.create(newOrder.lastInsertRowid);
      expect(shipment).toBeTruthy();
      expect(shipment.tracking_number).toContain('CRF');

      const byId = Shipment.findById(shipment.id);
      expect(byId).toBeTruthy();

      const byOrder = Shipment.findByOrderId(newOrder.lastInsertRowid);
      expect(byOrder.id).toBe(shipment.id);

      const byTracking = Shipment.findByTrackingNumber(shipment.tracking_number);
      expect(byTracking.id).toBe(shipment.id);

      const shipped = Shipment.updateStatus(shipment.id, 'shipped', 'Warehouse');
      expect(shipped.status).toBe('shipped');
      expect(shipped.shipped_at).toBeTruthy();

      const delivered = Shipment.updateStatus(shipment.id, 'delivered', 'Doorstep');
      expect(delivered.status).toBe('delivered');
      expect(delivered.delivered_at).toBeTruthy();

      const history = Shipment.getHistory(shipment.id);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(1);
    });

    test('findAll and getByUserId return expected data', () => {
      const allShipments = Shipment.findAll({ status: 'delivered' });
      expect(Array.isArray(allShipments)).toBe(true);

      const userShipments = Shipment.getByUserId(ids.custId);
      expect(Array.isArray(userShipments)).toBe(true);
    });
  });

};


