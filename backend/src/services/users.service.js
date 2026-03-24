const { db } = require("../models");

/**
 * Handles the getCurrentUser operation.
 * @param {unknown} userId
 * @returns {Promise<unknown>}
 */
async function getCurrentUser(userId) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarUrl: true,
      bio: true,
      artisanProfile: true,
    },
  });
}

/**
 * Handles the updateCurrentUser operation.
 * @param {unknown} userId
 * @param {unknown} payload
 * @returns {Promise<unknown>}
 */
async function updateCurrentUser(userId, payload) {
  return db.user.update({
    where: { id: userId },
    data: payload,
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarUrl: true,
      bio: true,
    },
  });
}

module.exports = {
  getCurrentUser,
  updateCurrentUser,
};
