const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Admin Routes Additional Coverage', () => {
    test('Admin user moderation covers invalid id, self-delete guard, and successful delete', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');
      const invalidId = await agent.post('/admin/users/0/status').send({ status: 'active' });
      expect(invalidId.statusCode).toBe(302);
      expect(invalidId.headers.location).toContain('/admin/users');

      const invalidStatus = await agent
        .post(`/admin/users/${ids.custId}/status`)
        .set('X-Requested-With', 'XMLHttpRequest')
        .send({ status: 'super-admin' });
      expect(invalidStatus.statusCode).toBe(400);
      expect(invalidStatus.body.success).toBe(false);

      const selfDelete = await agent
        .post(`/admin/users/${ids.adminId}/delete`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(selfDelete.statusCode).toBe(400);
      expect(selfDelete.body.success).toBe(false);

      const tempDeleteEmail = `${makeUnique('delete_target')}@test.com`;
      const deleteTargetId = db.prepare('INSERT INTO users (name,email,password,role,status) VALUES (?,?,?,?,?)')
        .run('Delete Target', tempDeleteEmail, 'hash', 'customer', 'active').lastInsertRowid;

      const deleted = await agent
        .post(`/admin/users/${deleteTargetId}/delete`)
        .set('X-Requested-With', 'XMLHttpRequest');
      expect(deleted.statusCode).toBe(200);
      expect(deleted.body.success).toBe(true);
      expect(db.prepare('SELECT id FROM users WHERE id = ?').get(deleteTargetId)).toBeUndefined();
    });

  });
};
