const artisanService = require("../services/artisan.service");

/**
 * Handles the getById operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function getById(req, res) {
  const artisan = await artisanService.getArtisanById(req.params.id);
  res.json({ success: true, artisan });
}

/**
 * Handles the register operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function register(req, res) {
  const result = await artisanService.registerArtisan(req.auth.sub, req.body);
  res.status(201).json({ success: true, ...result });
}

/**
 * Handles the dashboard operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function dashboard(req, res) {
  const stats = await artisanService.getDashboardStats(req.auth.sub);
  res.json({ success: true, stats });
}

/**
 * Handles the orders operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function orders(req, res) {
  const items = await artisanService.getArtisanOrders(req.auth.sub);
  res.json({ success: true, items });
}

/**
 * Handles the analytics operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function analytics(req, res) {
  const analytics = await artisanService.getAnalytics(req.auth.sub);
  res.json({ success: true, analytics });
}

module.exports = {
  getById,
  register,
  dashboard,
  orders,
  analytics,
};
