const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const CartItemModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.cartItem.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.cartItem.findFirst ? prisma.cartItem.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.cartItem.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.cartItem.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.cartItem.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.cartItem.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.cartItem.count ? prisma.cartItem.count(args) : null,
};

module.exports = CartItemModel;