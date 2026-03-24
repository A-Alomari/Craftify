const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const BidModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.bid.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.bid.findFirst ? prisma.bid.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.bid.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.bid.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.bid.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.bid.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.bid.count ? prisma.bid.count(args) : null,
};

module.exports = BidModel;