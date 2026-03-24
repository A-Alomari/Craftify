const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const CartModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.cart.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.cart.findFirst ? prisma.cart.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.cart.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.cart.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.cart.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.cart.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.cart.count ? prisma.cart.count(args) : null,
};

module.exports = CartModel;