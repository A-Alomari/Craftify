const notificationsService = require("../services/notifications.service");

/**
 * Handles the list operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function list(req, res) {
  const items = await notificationsService.listNotifications(req.auth.sub);
  res.json({ success: true, items });
}

/**
 * Handles the markRead operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function markRead(req, res) {
  const notification = await notificationsService.markRead(req.params.id, req.auth.sub);
  res.json({ success: true, notification });
}

module.exports = {
  list,
  markRead,
};
