const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const OrderItemModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.orderItem.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.orderItem.findFirst ? prisma.orderItem.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.orderItem.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.orderItem.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.orderItem.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.orderItem.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.orderItem.count ? prisma.orderItem.count(args) : null,
};

module.exports = OrderItemModel;