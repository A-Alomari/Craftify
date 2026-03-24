const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const MessageModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.message.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.message.findFirst ? prisma.message.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.message.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.message.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.message.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.message.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.message.count ? prisma.message.count(args) : null,
};

module.exports = MessageModel;