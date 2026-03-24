const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const NotificationModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.notification.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.notification.findFirst ? prisma.notification.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.notification.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.notification.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.notification.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.notification.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.notification.count ? prisma.notification.count(args) : null,
};

module.exports = NotificationModel;