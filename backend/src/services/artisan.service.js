const { db } = require("../models");
const { NotFoundError } = require("../utils/http");

/**
 * Handles the getArtisanById operation.
 * @param {unknown} id
 * @returns {Promise<unknown>}
 */
async function getArtisanById(id) {
  const artisan = await db.user.findFirst({
    where: { id, role: "ARTISAN" },
    select: {
      id: true,
      fullName: true,
      avatarUrl: true,
      bio: true,
      artisanProfile: true,
      products: {
        where: { status: "ACTIVE" },
        include: { category: true },
      },
    },
  });

  if (!artisan) {
    throw new NotFoundError("Artisan not found");
  }

  return artisan;
}

/**
 * Handles the registerArtisan operation.
 * @param {unknown} userId
 * @param {unknown} payload
 * @returns {Promise<unknown>}
 */
async function registerArtisan(userId, payload) {
  const user = await db.user.update({
    where: { id: userId },
    data: { role: "ARTISAN" },
  });

  const profile = await db.artisanProfile.upsert({
    where: { userId },
    create: {
      userId,
      shopName: payload.shopName,
      location: payload.location,
    },
    update: {
      shopName: payload.shopName,
      location: payload.location,
    },
  });

  return { user, profile };
}

/**
 * Handles the getDashboardStats operation.
 * @param {unknown} artisanId
 * @returns {Promise<unknown>}
 */
async function getDashboardStats(artisanId) {
  const [productCount, liveAuctionCount, ordersCount] = await Promise.all([
    db.product.count({ where: { artisanId } }),
    db.auction.count({ where: { product: { artisanId }, status: "LIVE" } }),
    db.orderItem.count({ where: { product: { artisanId } } }),
  ]);

  return { productCount, liveAuctionCount, ordersCount };
}

/**
 * Handles the getArtisanOrders operation.
 * @param {unknown} artisanId
 * @returns {Promise<unknown>}
 */
async function getArtisanOrders(artisanId) {
  return db.orderItem.findMany({
    where: { product: { artisanId } },
    include: {
      order: true,
      product: true,
    },
    orderBy: { order: { createdAt: "desc" } },
  });
}

/**
 * Handles the getAnalytics operation.
 * @param {unknown} artisanId
 * @returns {Promise<unknown>}
 */
async function getAnalytics(artisanId) {
  const items = await db.orderItem.findMany({
    where: { product: { artisanId } },
    include: { order: true, product: true },
  });

  const grossSales = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const unitsSold = items.reduce((sum, item) => sum + item.quantity, 0);

  return { grossSales, unitsSold };
}

module.exports = {
  getArtisanById,
  registerArtisan,
  getDashboardStats,
  getArtisanOrders,
  getAnalytics,
};
