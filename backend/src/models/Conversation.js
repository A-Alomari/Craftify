const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const ConversationModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.conversation.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.conversation.findFirst ? prisma.conversation.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.conversation.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.conversation.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.conversation.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.conversation.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.conversation.count ? prisma.conversation.count(args) : null,
};

module.exports = ConversationModel;