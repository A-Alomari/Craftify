const request = require('supertest');

module.exports = ({ getTestContext, loginAs, makeUnique }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Admin Routes Additional Coverage', () => {
    test('Admin reports supports alternate period filters', async () => {
      const agent = await loginAs('admin@test.com', 'admin123');
      const week = await agent.get('/admin/reports?period=week');
      expect(week.statusCode).toBe(200);

      const year = await agent.get('/admin/reports?period=year');
      expect(year.statusCode).toBe(200);
    });
  });
};
