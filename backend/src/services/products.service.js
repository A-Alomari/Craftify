const { db } = require("../models");
const { ForbiddenError, NotFoundError } = require("../utils/http");

/**
 * Handles the listProducts operation.
 * @param {unknown} query
 * @returns {Promise<unknown>}
 */
async function listProducts(query) {
  const page = Number(query.page || 1);
  const pageSize = Number(query.pageSize || 12);
  const q = String(query.q || "");
  const categoryId = query.categoryId ? String(query.categoryId) : undefined;

  const where = {
    status: "ACTIVE",
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    db.product.findMany({
      where,
      include: {
        artisan: { select: { id: true, fullName: true } },
        category: true,
        _count: { select: { reviews: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    }),
    db.product.count({ where }),
  ]);

  return { page, pageSize, total, items };
}

/**
 * Handles the getProductById operation.
 * @param {unknown} id
 * @returns {Promise<unknown>}
 */
async function getProductById(id) {
  const product = await db.product.findUnique({
    where: { id },
    include: {
      artisan: { select: { id: true, fullName: true } },
      category: true,
      reviews: { include: { user: { select: { id: true, fullName: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return product;
}

/**
 * Handles the createProduct operation.
 * @param {unknown} data
 * @param {unknown} artisanId
 * @returns {Promise<unknown>}
 */
async function createProduct(data, artisanId) {
  return db.product.create({
    data: {
      ...data,
      artisanId,
    },
  });
}

/**
 * Handles the updateProduct operation.
 * @param {unknown} id
 * @param {unknown} data
 * @param {unknown} auth
 * @returns {Promise<unknown>}
 */
async function updateProduct(id, data, auth) {
  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Product not found");
  }

  if (auth.role !== "ADMIN" && existing.artisanId !== auth.sub) {
    throw new ForbiddenError("You can only edit your own products");
  }

  return db.product.update({
    where: { id },
    data,
  });
}

/**
 * Handles the deleteProduct operation.
 * @param {unknown} id
 * @param {unknown} auth
 * @returns {Promise<unknown>}
 */
async function deleteProduct(id, auth) {
  const existing = await db.product.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("Product not found");
  }

  if (auth.role !== "ADMIN" && existing.artisanId !== auth.sub) {
    throw new ForbiddenError("You can only delete your own products");
  }

  await db.product.delete({ where: { id } });
  return { message: "Product deleted" };
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
