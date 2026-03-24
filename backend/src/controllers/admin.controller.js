const adminService = require("../services/admin.service");

/**
 * Handles the dashboard operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function dashboard(req, res) {
  const stats = await adminService.getDashboardStats();
  res.json({ success: true, stats });
}

/**
 * Handles the users operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function users(req, res) {
  const items = await adminService.listUsers();
  res.json({ success: true, items });
}

/**
 * Handles the orders operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function orders(req, res) {
  const items = await adminService.listOrders();
  res.json({ success: true, items });
}

/**
 * Handles the updateUser operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function updateUser(req, res) {
  const user = await adminService.updateUser(req.params.id, req.body);
  res.json({ success: true, user });
}

module.exports = {
  dashboard,
  users,
  orders,
  updateUser,
};
