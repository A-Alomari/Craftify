const usersService = require("../services/users.service");

/**
 * Handles the me operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function me(req, res) {
  const user = await usersService.getCurrentUser(req.auth.sub);
  res.json({ success: true, user });
}

/**
 * Handles the updateMe operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function updateMe(req, res) {
  const user = await usersService.updateCurrentUser(req.auth.sub, req.body);
  res.json({ success: true, user });
}

module.exports = {
  me,
  updateMe,
};
