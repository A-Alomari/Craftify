module.exports = ({ getTestContext, makeUnique }) => {
  let db;
  let ids;

  beforeAll(() => {
    ({ db, ids } = getTestContext());
  });

  describe('NewsletterSubscription Model', () => {
    const NewsletterSubscription = require('../../models/NewsletterSubscription');

    test('subscribe inserts once and ignores duplicates', () => {
      const email = `${makeUnique('newsletter')}@test.com`;

      const firstInsert = NewsletterSubscription.subscribe(email);
      expect(firstInsert).toBeTruthy();
      expect(firstInsert.changes).toBe(1);

      const duplicateInsert = NewsletterSubscription.subscribe(email);
      expect(duplicateInsert).toBeTruthy();
      expect(duplicateInsert.changes).toBe(0);

      const stored = db.prepare('SELECT COUNT(*) as count FROM newsletter_subscriptions WHERE email = ?').get(email);
      expect(stored.count).toBe(1);
    });

    test('findAll returns an array containing all subscribed emails', () => {
      const email1 = `${makeUnique('nl_a')}@test.com`;
      const email2 = `${makeUnique('nl_b')}@test.com`;
      NewsletterSubscription.subscribe(email1);
      NewsletterSubscription.subscribe(email2);
      const all = NewsletterSubscription.findAll();
      expect(Array.isArray(all)).toBe(true);
      const emails = all.map(s => s.email);
      expect(emails).toContain(email1);
      expect(emails).toContain(email2);
    });

    test('count returns the total number of subscribers', () => {
      const before = NewsletterSubscription.count();
      expect(typeof before).toBe('number');
      NewsletterSubscription.subscribe(`${makeUnique('nl_count')}@test.com`);
      expect(NewsletterSubscription.count()).toBe(before + 1);
    });
  });

  describe('PasswordReset Model', () => {
    const PasswordReset = require('../../models/PasswordReset');

    test('create and findById return reset row', () => {
      const token = `sha256:${makeUnique('reset_token')}`;
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const created = PasswordReset.create({
        user_id: ids.custId,
        token,
        expires_at: expiresAt
      });

      expect(created).toBeTruthy();
      expect(created.user_id).toBe(ids.custId);
      expect(created.token).toBe(token);

      const byId = PasswordReset.findById(created.id);
      expect(byId).toBeTruthy();
      expect(byId.id).toBe(created.id);
    });

    test('findValidByToken and markUsed update token validity', () => {
      const token = `sha256:${makeUnique('valid_token')}`;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();

      const created = PasswordReset.create({
        user_id: ids.custId,
        token,
        expires_at: expiresAt
      });

      const valid = PasswordReset.findValidByToken(token, nowIso);
      expect(valid).toBeTruthy();
      expect(valid.id).toBe(created.id);

      PasswordReset.markUsed(created.id);
      const afterUse = PasswordReset.findValidByToken(token, nowIso);
      expect(afterUse).toBeUndefined();
    });

    test('findValidByLegacyToken only returns non-hashed legacy tokens', () => {
      const legacyToken = makeUnique('legacy_token');
      const hashedToken = `sha256:${makeUnique('hashed_token')}`;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();

      PasswordReset.create({
        user_id: ids.custId,
        token: legacyToken,
        expires_at: expiresAt
      });

      PasswordReset.create({
        user_id: ids.custId,
        token: hashedToken,
        expires_at: expiresAt
      });

      const legacyMatch = PasswordReset.findValidByLegacyToken(legacyToken, nowIso);
      expect(legacyMatch).toBeTruthy();
      expect(legacyMatch.token).toBe(legacyToken);

      const hashedMatch = PasswordReset.findValidByLegacyToken(hashedToken, nowIso);
      expect(hashedMatch).toBeUndefined();
    });
  });
};