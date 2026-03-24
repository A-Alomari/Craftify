const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const ProductModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.product.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.product.findFirst ? prisma.product.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.product.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.product.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.product.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.product.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.product.count ? prisma.product.count(args) : null,
  /**
   * Model accessor/helper: isOwnedBy.
   */
  isOwnedBy: (product, userId) => product && product.artisanId === userId,
  /**
   * Model accessor/helper: buildActiveSearchWhere.
   */
  buildActiveSearchWhere: ({ q, categoryId }) => ({
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
  }),
};

module.exports = ProductModel;