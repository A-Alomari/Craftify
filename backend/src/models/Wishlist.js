const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const WishlistModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.wishlist.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.wishlist.findFirst ? prisma.wishlist.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.wishlist.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.wishlist.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.wishlist.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.wishlist.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.wishlist.count ? prisma.wishlist.count(args) : null,
};

module.exports = WishlistModel;