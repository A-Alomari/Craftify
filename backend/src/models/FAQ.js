const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const FAQModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.faq.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.faq.findFirst ? prisma.faq.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.faq.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.faq.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.faq.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.faq.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.faq.count ? prisma.faq.count(args) : null,
};

module.exports = FAQModel;