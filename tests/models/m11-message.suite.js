module.exports = ({ getTestContext }) => {
  let app;
  let db;
  let ids;

  beforeAll(() => {
    ({ app, db, ids } = getTestContext());
  });
  describe('Message Model', () => {
    const Message = require('../../models/Message');

    test('create, findById, thread and conversation methods work', () => {
      const created = Message.create({
        sender_id: ids.custId,
        receiver_id: ids.artId,
        subject: 'Test Subject',
        content: 'Test content'
      });

      expect(created).toBeTruthy();
      expect(created.sender_id).toBe(ids.custId);
      expect(created.receiver_id).toBe(ids.artId);

      const byId = Message.findById(created.id);
      expect(byId).toBeTruthy();
      expect(byId.content).toContain('Test content');

      const thread = Message.getThread(ids.custId, ids.artId);
      expect(Array.isArray(thread)).toBe(true);
      expect(thread.length).toBeGreaterThan(0);

      const conversations = Message.getConversations(ids.custId);
      expect(Array.isArray(conversations)).toBe(true);
    });

    test('markAsRead, markThreadAsRead, unread count and delete work', () => {
      const unreadMsg = Message.create({
        sender_id: ids.artId,
        receiver_id: ids.custId,
        content: 'Unread message'
      });

      const unreadBefore = Message.getUnreadCount(ids.custId);
      expect(unreadBefore).toBeGreaterThan(0);

      Message.markAsRead(unreadMsg.id);
      const afterSingleRead = Message.findById(unreadMsg.id);
      expect(afterSingleRead.is_read).toBe(1);

      const unreadThreadMsg = Message.create({
        sender_id: ids.artId,
        receiver_id: ids.custId,
        content: 'Thread unread message'
      });
      expect(unreadThreadMsg).toBeTruthy();

      Message.markThreadAsRead(ids.custId, ids.artId);
      const unreadAfterThread = Message.getUnreadCount(ids.custId);
      expect(unreadAfterThread).toBe(0);

      const toDelete = Message.create({
        sender_id: ids.custId,
        receiver_id: ids.artId,
        content: 'Delete me'
      });
      Message.delete(toDelete.id);
      expect(Message.findById(toDelete.id)).toBeUndefined();
    });
  });

};


