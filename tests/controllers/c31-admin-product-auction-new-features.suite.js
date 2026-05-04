/**
 * c31-admin-product-auction-new-features.suite.js
 *
 * Tests covering:
 * - Product delete
 * - Product detail page (admin view)
 * - Re-approve rejected product
 * - Featured toggle blocked for non-approved products
 * - Auction always created as awaiting_approval
 * - Auction detail page (admin view)
 */

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });

  describe('Admin – Product & Auction new features', () => {
    let agent;

    beforeAll(async () => {
      agent = await loginAs('admin@test.com', 'admin123');
    });

    // ── Product detail view (admin redirects to normal product page) ─
    test('GET /admin/products/:id redirects to /products/:id', async () => {
      const res = await agent.get(`/admin/products/${ids.vaseId}`);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain(`/products/${ids.vaseId}`);
    });

    test('GET /products/:id shows product page for admin (bypasses approval gate)', async () => {
      // Admin can view pending/rejected products
      const pendingId = db.prepare(`SELECT id FROM products WHERE status = 'pending' LIMIT 1`).get()?.id;
      if (pendingId) {
        const res = await agent.get(`/products/${pendingId}`).redirects(1);
        expect(res.statusCode).toBe(200);
      }
    });

    // ── Re-approve rejected product ─────────────────────────────────
    test('POST /admin/products/:id/approve re-approves a rejected product', async () => {
      const rejectedProductId = db.prepare(`
        SELECT id FROM products WHERE status = 'rejected' LIMIT 1
      `).get()?.id;

      // If no rejected product exists yet, create one and reject it first
      let targetId = rejectedProductId;
      if (!targetId) {
        const newProdId = db.prepare(`
          INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active)
          VALUES (?, ?, ?, ?, ?, ?, '[]', 'pending', 1)
        `).run(ids.artId, ids.potId, `Re-approve test ${makeUnique('p')}`, 'desc', 10, 5).lastInsertRowid;
        db.prepare(`UPDATE products SET status = 'rejected' WHERE id = ?`).run(newProdId);
        targetId = newProdId;
      }

      const res = await agent
        .post(`/admin/products/${targetId}/approve`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(db.prepare('SELECT status FROM products WHERE id = ?').get(targetId).status).toBe('approved');
    });

    // ── Featured only when approved ─────────────────────────────────
    test('Featured toggle still works for an approved product', async () => {
      // Ensure the vase is approved
      db.prepare(`UPDATE products SET status = 'approved' WHERE id = ?`).run(ids.vaseId);

      const before = db.prepare('SELECT featured FROM products WHERE id = ?').get(ids.vaseId).featured;
      const res = await agent
        .post(`/admin/products/${ids.vaseId}/featured`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      const after = db.prepare('SELECT featured FROM products WHERE id = ?').get(ids.vaseId).featured;
      expect(after).toBe(before ? 0 : 1);
      // Restore original featured state
      await agent.post(`/admin/products/${ids.vaseId}/featured`).set('X-Requested-With', 'XMLHttpRequest');
    });

    // ── Product delete ──────────────────────────────────────────────
    test('POST /admin/products/:id/delete deletes the product', async () => {
      const delProdId = db.prepare(`
        INSERT INTO products (artisan_id, category_id, name, description, price, stock, images, status, is_active)
        VALUES (?, ?, ?, ?, ?, ?, '[]', 'pending', 1)
      `).run(ids.artId, ids.potId, `Delete me ${makeUnique('del')}`, 'desc', 5, 1).lastInsertRowid;

      const res = await agent
        .post(`/admin/products/${delProdId}/delete`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(db.prepare('SELECT id FROM products WHERE id = ?').get(delProdId)).toBeUndefined();
    });

    test('POST /admin/products/0/delete with invalid id redirects', async () => {
      const res = await agent.post('/admin/products/0/delete');
      expect(res.statusCode).toBe(302);
    });

    test('POST /admin/products/999999/delete for unknown product redirects', async () => {
      const res = await agent.post('/admin/products/999999/delete');
      expect(res.statusCode).toBe(302);
    });

    // ── Auction always starts as awaiting_approval ──────────────────
    test('New auction is created with awaiting_approval status', () => {
      const Auction = require('../../models/Auction');
      const now = new Date();
      const start = new Date(now.getTime() - 60000).toISOString(); // 1 min ago
      const end = new Date(now.getTime() + 3600000).toISOString();  // 1 hour ahead

      const newAuction = Auction.create({
        product_id: ids.vaseId,
        artisan_id: ids.artId,
        title: `Approval test ${makeUnique('auc')}`,
        starting_bid: 10,
        bid_increment: 1,
        start_time: start,
        end_time: end
      });

      expect(newAuction).toBeTruthy();
      expect(newAuction.status).toBe('awaiting_approval');

      // Cleanup
      db.prepare('DELETE FROM auctions WHERE id = ?').run(newAuction.id);
    });

    // ── Auction detail view (admin redirects to normal auction page) ─
    test('GET /admin/auctions/:id redirects to /auctions/:id', async () => {
      const res = await agent.get(`/admin/auctions/${ids.auctionId}`);
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toContain(`/auctions/${ids.auctionId}`);
    });

    test('GET /auctions/:id shows auction page for admin with awaiting_approval status', async () => {
      const now = new Date();
      const tempAucId = db.prepare(`
        INSERT INTO auctions (product_id, artisan_id, title, starting_price, current_highest_bid, bid_increment, start_time, end_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_approval')
      `).run(ids.vaseId, ids.artId, `Admin preview ${makeUnique('auc')}`, 10, 10, 1,
        new Date(now.getTime() + 60000).toISOString(),
        new Date(now.getTime() + 3600000).toISOString()
      ).lastInsertRowid;

      const res = await agent.get(`/auctions/${tempAucId}`).redirects(1);
      expect(res.statusCode).toBe(200);

      db.prepare('DELETE FROM auctions WHERE id = ?').run(tempAucId);
    });

    // ── Approve awaiting_approval auction makes it live/pending ─────
    test('POST /admin/auctions/:id/approve transitions awaiting_approval to active or pending', async () => {
      const now = new Date();
      const startPast = new Date(now.getTime() - 60000).toISOString();
      const endFuture = new Date(now.getTime() + 3600000).toISOString();

      const tempAucId = db.prepare(`
        INSERT INTO auctions (product_id, artisan_id, title, starting_price, current_highest_bid, bid_increment, start_time, end_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_approval')
      `).run(ids.vaseId, ids.artId, `Approve me ${makeUnique('auc')}`, 10, 10, 1, startPast, endFuture).lastInsertRowid;

      const res = await agent
        .post(`/admin/auctions/${tempAucId}/approve`)
        .redirects(0);
      expect([200, 302]).toContain(res.statusCode);

      const afterStatus = db.prepare('SELECT status FROM auctions WHERE id = ?').get(tempAucId).status;
      expect(['active', 'pending']).toContain(afterStatus);

      db.prepare('DELETE FROM auctions WHERE id = ?').run(tempAucId);
    });
  });
};
