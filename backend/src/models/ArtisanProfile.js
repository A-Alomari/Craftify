const { prisma } = require("../db/prisma");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const ArtisanProfileModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.artisanProfile.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.artisanProfile.findFirst ? prisma.artisanProfile.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.artisanProfile.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.artisanProfile.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.artisanProfile.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.artisanProfile.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.artisanProfile.count ? prisma.artisanProfile.count(args) : null,
};

module.exports = ArtisanProfileModel;