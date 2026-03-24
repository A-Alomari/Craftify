const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const CategoryModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.category.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.category.findFirst ? prisma.category.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.category.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.category.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.category.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.category.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.category.count ? prisma.category.count(args) : null,
};

module.exports = CategoryModel;