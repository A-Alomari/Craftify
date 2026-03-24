const ordersService = require("../services/orders.service");

/**
 * Handles the checkout operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function checkout(req, res) {
  const result = await ordersService.checkout(req.auth.sub, req.body);
  res.status(201).json({ success: true, ...result });
}

/**
 * Handles the list operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function list(req, res) {
  const items = await ordersService.listOrders(req.auth);
  res.json({ success: true, items });
}

/**
 * Handles the getById operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function getById(req, res) {
  const order = await ordersService.getOrderById(req.params.id, req.auth);
  res.json({ success: true, order });
}

/**
 * Handles the updateStatus operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function updateStatus(req, res) {
  const order = await ordersService.updateOrderStatus(req.params.id, req.body.status);
  res.json({ success: true, order });
}

/**
 * Handles the confirm operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function confirm(req, res) {
  const order = await ordersService.confirmOrder(req.params.id, req.auth);
  res.json({ success: true, order });
}

module.exports = {
  checkout,
  list,
  getById,
  updateStatus,
  confirm,
};
