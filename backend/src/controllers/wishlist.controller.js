const wishlistService = require("../services/wishlist.service");

/**
 * Handles the get operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function get(req, res) {
  const wishlist = await wishlistService.getWishlist(req.auth.sub);
  res.json({ success: true, wishlist });
}

/**
 * Handles the add operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function add(req, res) {
  const item = await wishlistService.addToWishlist(req.auth.sub, req.body.productId);
  res.status(201).json({ success: true, item });
}

/**
 * Handles the remove operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function remove(req, res) {
  await wishlistService.removeFromWishlist(req.auth.sub, req.query.productId);
  res.json({ success: true, message: "Removed from wishlist" });
}

module.exports = {
  get,
  add,
  remove,
};
