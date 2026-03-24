const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const AuctionModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.auction.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.auction.findFirst ? prisma.auction.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.auction.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.auction.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.auction.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.auction.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.auction.count ? prisma.auction.count(args) : null,
};

module.exports = AuctionModel;