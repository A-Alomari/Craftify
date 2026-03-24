const { db } = require("../models");

/**
 * Handles the getOrCreateWishlist operation.
 * @param {unknown} userId
 * @returns {Promise<unknown>}
 */
async function getOrCreateWishlist(userId) {
  const existing = await db.wishlist.findUnique({ where: { userId } });
  if (existing) {
    return existing;
  }

  return db.wishlist.create({ data: { userId } });
}

/**
 * Handles the getWishlist operation.
 * @param {unknown} userId
 * @returns {Promise<unknown>}
 */
async function getWishlist(userId) {
  const wishlist = await getOrCreateWishlist(userId);
  return db.wishlist.findUnique({
    where: { id: wishlist.id },
    include: { items: { include: { product: true } } },
  });
}

/**
 * Handles the addToWishlist operation.
 * @param {unknown} userId
 * @param {unknown} productId
 * @returns {Promise<unknown>}
 */
async function addToWishlist(userId, productId) {
  const wishlist = await getOrCreateWishlist(userId);
  return db.wishlistItem.upsert({
    where: {
      wishlistId_productId: {
        wishlistId: wishlist.id,
        productId,
      },
    },
    create: {
      wishlistId: wishlist.id,
      productId,
    },
    update: {},
  });
}

/**
 * Handles the removeFromWishlist operation.
 * @param {unknown} userId
 * @param {unknown} productId
 * @returns {Promise<unknown>}
 */
async function removeFromWishlist(userId, productId) {
  const wishlist = await getOrCreateWishlist(userId);
  await db.wishlistItem.delete({
    where: {
      wishlistId_productId: {
        wishlistId: wishlist.id,
        productId,
      },
    },
  });
}

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
