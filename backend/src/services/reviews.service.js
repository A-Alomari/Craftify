const { db } = require("../models");

/**
 * Handles the upsertReview operation.
 * @param {unknown} userId
 * @param {unknown} payload
 * @returns {Promise<unknown>}
 */
async function upsertReview(userId, payload) {
  return db.review.upsert({
    where: {
      userId_productId: {
        userId,
        productId: payload.productId,
      },
    },
    create: {
      userId,
      productId: payload.productId,
      rating: payload.rating,
      title: payload.title,
      body: payload.body,
    },
    update: {
      rating: payload.rating,
      title: payload.title,
      body: payload.body,
    },
  });
}

/**
 * Handles the listProductReviews operation.
 * @param {unknown} productId
 * @returns {Promise<unknown>}
 */
async function listProductReviews(productId) {
  return db.review.findMany({
    where: { productId },
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

module.exports = {
  upsertReview,
  listProductReviews,
};
