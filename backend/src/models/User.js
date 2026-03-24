const { prisma } = require("../db/prisma");
const bcrypt = require("bcryptjs");

/**
 * Model-layer accessors and helper functions for this entity.
 * Methods in this object are intentionally thin wrappers around Prisma delegates
 * plus entity-specific model helpers.
 * @type {Record<string, Function>}
 */
const UserModel = {
  /**
   * Model accessor/helper: findUnique.
   */
  findUnique: (args) => prisma.user.findUnique(args),
  /**
   * Model accessor/helper: findFirst.
   */
  findFirst: (args) => prisma.user.findFirst ? prisma.user.findFirst(args) : null,
  /**
   * Model accessor/helper: findMany.
   */
  findMany: (args) => prisma.user.findMany(args),
  /**
   * Model accessor/helper: create.
   */
  create: (args) => prisma.user.create(args),
  /**
   * Model accessor/helper: update.
   */
  update: (args) => prisma.user.update(args),
  /**
   * Model accessor/helper: delete.
   */
  delete: (args) => prisma.user.delete(args),
  /**
   * Model accessor/helper: count.
   */
  count: (args) => prisma.user.count ? prisma.user.count(args) : null,
  /**
   * Model accessor/helper: findByEmail.
   */
  findByEmail: (email) => prisma.user.findUnique({ where: { email } }),
  /**
   * Model accessor/helper: comparePassword.
   */
  comparePassword: (plain, passwordHash) => bcrypt.compare(plain, passwordHash),
  /**
   * Model accessor/helper: toPublicProfile.
   */
  toPublicProfile: (user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
  }),
};

module.exports = UserModel;