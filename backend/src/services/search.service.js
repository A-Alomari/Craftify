const { db } = require("../models");

/**
 * Handles the search operation.
 * @param {unknown} qRaw
 * @returns {Promise<unknown>}
 */
async function search(qRaw) {
  const q = String(qRaw || "").trim();
  if (!q) {
    return { products: [], artisans: [] };
  }

  const [products, artisans] = await Promise.all([
    db.product.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
        ],
      },
      include: { artisan: { select: { id: true, fullName: true } } },
      take: 20,
    }),
    db.user.findMany({
      where: {
        role: "ARTISAN",
        OR: [{ fullName: { contains: q, mode: "insensitive" } }],
      },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
      },
      take: 20,
    }),
  ]);

  return { products, artisans };
}

module.exports = {
  search,
};
