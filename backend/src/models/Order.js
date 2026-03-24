const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const OrderModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.order.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.order.findFirst ? prisma.order.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.order.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.order.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.order.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.order.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.order.count ? prisma.order.count(args) : null,
};

module.exports = OrderModel;