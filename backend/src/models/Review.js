const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const ReviewModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.review.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.review.findFirst ? prisma.review.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.review.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.review.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.review.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.review.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.review.count ? prisma.review.count(args) : null,
};

module.exports = ReviewModel;