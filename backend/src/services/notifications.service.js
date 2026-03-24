const { db } = require("../models");
const { NotFoundError, ForbiddenError } = require("../utils/http");

/**
 * Handles the listNotifications operation.
 * @param {unknown} userId
 * @returns {Promise<unknown>}
 */
async function listNotifications(userId) {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Handles the markRead operation.
 * @param {unknown} id
 * @param {unknown} userId
 * @returns {Promise<unknown>}
 */
async function markRead(id, userId) {
  const notification = await db.notification.findUnique({ where: { id } });
  if (!notification) {
    throw new NotFoundError("Notification not found");
  }

  if (notification.userId !== userId) {
    throw new ForbiddenError("Not allowed");
  }

  return db.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

module.exports = {
  listNotifications,
  markRead,
};
