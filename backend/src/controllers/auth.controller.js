const authService = require("../services/auth.service");

/**
 * Create a new user account and return auth tokens.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function register(req, res) {
  const result = await authService.register(req.body);
  res.status(201).json({ success: true, ...result });
}

/**
 * Authenticate a user with email/password and return auth tokens.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function login(req, res) {
  const result = await authService.login(req.body);
  res.json({ success: true, ...result });
}

/**
 * Return the currently authenticated user profile.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function me(req, res) {
  const user = await authService.getCurrentUser(req.auth.sub);
  res.json({ success: true, user });
}

/**
 * Start the password recovery flow by issuing a verification code.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function forgotPassword(req, res) {
  const result = await authService.forgotPassword(req.body);
  res.json({ success: true, ...result });
}

/**
 * Verify a password recovery code for an email address.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function verifyCode(req, res) {
  const result = await authService.verifyCode(req.body);
  res.json({ success: true, ...result });
}

/**
 * Complete password recovery by saving a new user password.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function resetPassword(req, res) {
  const result = await authService.resetPassword(req.body);
  res.json({ success: true, ...result });
}

module.exports = {
  register,
  login,
  me,
  forgotPassword,
  verifyCode,
  resetPassword,
};
