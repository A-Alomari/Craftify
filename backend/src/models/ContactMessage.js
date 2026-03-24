const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const ContactMessageModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.contactMessage.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.contactMessage.findFirst ? prisma.contactMessage.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.contactMessage.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.contactMessage.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.contactMessage.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.contactMessage.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.contactMessage.count ? prisma.contactMessage.count(args) : null,
};

module.exports = ContactMessageModel;