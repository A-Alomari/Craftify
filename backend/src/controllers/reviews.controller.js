const reviewsService = require("../services/reviews.service");

/**
 * Handles the upsert operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function upsert(req, res) {
  const review = await reviewsService.upsertReview(req.auth.sub, req.body);
  res.status(201).json({ success: true, review });
}

/**
 * Handles the listByProduct operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function listByProduct(req, res) {
  const items = await reviewsService.listProductReviews(req.params.productId);
  res.json({ success: true, items });
}

module.exports = {
  upsert,
  listByProduct,
};
