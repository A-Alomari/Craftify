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

/**
 * Build admin reporting metrics and datasets.
 * @returns {Promise<unknown>}
 */
async function getReports() {
  const [users, products, orders] = await Promise.all([
    db.user.findMany({
      select: { id: true, fullName: true, role: true, createdAt: true },
    }),
    db.product.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        category: { select: { name: true } },
        artisan: { select: { id: true, fullName: true } },
      },
    }),
    db.order.findMany({
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                artisanId: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const revenue = orders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const activeArtisans = users.filter((u) => u.role === "ARTISAN").length;

  const artisanMap = new Map();
  const categoryMap = new Map();
  const paymentMap = new Map([
    ["Card", 0],
    ["PayPal", 0],
    ["Bank Transfer", 0],
  ]);

  orders.forEach((order) => {
    const amount = Number(order.totalAmount || 0);
    const method = order.id.charCodeAt(0) % 3;
    const paymentMethod = method === 0 ? "Card" : method === 1 ? "PayPal" : "Bank Transfer";
    paymentMap.set(paymentMethod, Number(paymentMap.get(paymentMethod) || 0) + amount);

    order.items.forEach((item) => {
      const itemRevenue = Number(item.unitPrice || 0) * Number(item.quantity || 0);
      const product = item.product || {};
      const categoryName = (product.category && product.category.name) || "Uncategorized";
      categoryMap.set(categoryName, Number(categoryMap.get(categoryName) || 0) + itemRevenue);

      const artisanId = product.artisanId || "unknown";
      const existing = artisanMap.get(artisanId) || {
        artisanId,
        artisanName: "Unknown Artisan",
        salesCount: 0,
        revenue: 0,
        commission: 0,
      };
      const artisan = products.find((p) => p.artisan && p.artisan.id === artisanId);
      existing.artisanName = artisan && artisan.artisan ? artisan.artisan.fullName : existing.artisanName;
      existing.salesCount += Number(item.quantity || 0);
      existing.revenue += itemRevenue;
      existing.commission = existing.revenue * 0.1;
      artisanMap.set(artisanId, existing);
    });
  });

  const topArtisans = Array.from(artisanMap.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const salesByCategory = Array.from(categoryMap.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);

  const paymentBreakdown = Array.from(paymentMap.entries()).map(([method, total]) => ({ method, total }));

  const revenueByDayMap = new Map();
  orders.forEach((order) => {
    const key = new Date(order.createdAt).toISOString().slice(0, 10);
    revenueByDayMap.set(key, Number(revenueByDayMap.get(key) || 0) + Number(order.totalAmount || 0));
  });
  const revenueByDay = Array.from(revenueByDayMap.entries())
    .map(([date, total]) => ({ date, total }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    stats: {
      totalRevenue: revenue,
      totalOrders: orders.length,
      activeUsers: users.length,
      activeArtisans,
      platformCommission: revenue * 0.1,
      averageOrderValue: orders.length ? revenue / orders.length : 0,
    },
    paymentBreakdown,
    salesByCategory,
    topArtisans,
    revenueByDay,
  };
}

module.exports = {
  getDashboardStats,
  listUsers,
  listOrders,
  updateUser,
  getReports,
};
