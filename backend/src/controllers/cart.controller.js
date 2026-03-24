const cartService = require("../services/cart.service");

/**
 * Handles the getCart operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function getCart(req, res) {
  const result = await cartService.getCart(req.auth.sub);
  res.json({ success: true, ...result });
}

/**
 * Handles the add operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function add(req, res) {
  const item = await cartService.addItem(req.auth.sub, req.body);
  res.status(201).json({ success: true, item });
}

/**
 * Handles the update operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function update(req, res) {
  const item = await cartService.updateItem(req.auth.sub, req.body);
  res.json({ success: true, item });
}

/**
 * Handles the remove operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function remove(req, res) {
  await cartService.removeItem(req.auth.sub, req.query.productId);
  res.json({ success: true, message: "Item removed from cart" });
}

module.exports = {
  getCart,
  add,
  update,
  remove,
};
