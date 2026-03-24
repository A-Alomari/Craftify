/**
 * Unit tests for notifications.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

const notificationsService = require("../../../src/services/notifications.service");
const { fakeNotification } = require("../../fixtures/users");

describe("Notifications Service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("listNotifications", () => {
    it("should return notifications for user", async () => {
      const notifs = [fakeNotification({ userId: "u1" })];
      mockDb.notification.findMany.mockResolvedValue(notifs);

      const result = await notificationsService.listNotifications("u1");

      expect(result).toHaveLength(1);
      expect(mockDb.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "u1" } })
      );
    });

    it("should return empty array when no notifications", async () => {
      mockDb.notification.findMany.mockResolvedValue([]);

      const result = await notificationsService.listNotifications("u1");
      expect(result).toHaveLength(0);
    });
  });

  describe("markRead", () => {
    it("should mark notification as read for owner", async () => {
      const notif = fakeNotification({ id: "n1", userId: "u1" });
      mockDb.notification.findUnique.mockResolvedValue(notif);
      mockDb.notification.update.mockResolvedValue({ ...notif, readAt: new Date() });

      const result = await notificationsService.markRead("n1", "u1");

      expect(mockDb.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "n1" },
          data: expect.objectContaining({ readAt: expect.any(Date) }),
        })
      );
    });

    it("should throw NotFoundError for non-existent notification", async () => {
      mockDb.notification.findUnique.mockResolvedValue(null);

      await expect(notificationsService.markRead("bad", "u1")).rejects.toThrow("Notification not found");
    });

    it("should throw ForbiddenError for another user's notification", async () => {
      mockDb.notification.findUnique.mockResolvedValue(fakeNotification({ id: "n1", userId: "u1" }));

      await expect(notificationsService.markRead("n1", "u2")).rejects.toThrow("Not allowed");
    });
  });
});
