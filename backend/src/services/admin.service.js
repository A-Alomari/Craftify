const { db } = require("../models");

/**
 * Handles the getDashboardStats operation.
 * @returns {Promise<unknown>}
 */
async function getDashboardStats() {
  const [users, products, orders, revenueAgg] = await Promise.all([
    db.user.count(),
    db.product.count(),
    db.order.count(),
    db.order.aggregate({ _sum: { totalAmount: true } }),
  ]);

  return {
    users,
    products,
    orders,
    revenue: revenueAgg._sum.totalAmount || 0,
  };
}

/**
 * Handles the listUsers operation.
 * @returns {Promise<unknown>}
 */
async function listUsers() {
  return db.user.findMany({
    select: { id: true, fullName: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Handles the listOrders operation.
 * @returns {Promise<unknown>}
 */
async function listOrders() {
  return db.order.findMany({
    include: { user: { select: { id: true, fullName: true, email: true } }, items: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Handles the updateUser operation.
 * @param {unknown} id
 * @param {unknown} payload
 * @returns {Promise<unknown>}
 */
async function updateUser(id, payload) {
  return db.user.update({
    where: { id },
    data: payload,
    select: { id: true, fullName: true, email: true, role: true },
  });
}

module.exports = {
  getDashboardStats,
  listUsers,
  listOrders,
  updateUser,
};
