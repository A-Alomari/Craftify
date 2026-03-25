const authService = require("../services/auth.service");
const { env } = require("../config/env");

function cookieConfig(maxAgeMs) {
  return {
    httpOnly: true,
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    secure: env.nodeEnv === "production",
    path: "/",
    maxAge: maxAgeMs,
  };
}

function setAuthCookies(res, tokens) {
  res.cookie(env.authCookieName, tokens.accessToken, cookieConfig(15 * 60 * 1000));
  res.cookie(env.refreshCookieName, tokens.refreshToken, cookieConfig(7 * 24 * 60 * 60 * 1000));
}

function clearAuthCookies(res) {
  const cfg = {
    httpOnly: true,
    sameSite: env.nodeEnv === "production" ? "none" : "lax",
    secure: env.nodeEnv === "production",
    path: "/",
  };
  res.clearCookie(env.authCookieName, cfg);
  res.clearCookie(env.refreshCookieName, cfg);
}

/**
 * Create a new user account and return auth tokens.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function register(req, res) {
  const result = await authService.register(req.body);
  setAuthCookies(res, result.tokens);
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
  setAuthCookies(res, result.tokens);
  res.json({ success: true, ...result });
}

/**
 * Refresh an auth session from a valid refresh token cookie.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function refresh(req, res) {
  const tokenFromCookie = req.cookies ? req.cookies[env.refreshCookieName] : "";
  const tokenFromBody = req.body && req.body.refreshToken ? req.body.refreshToken : "";
  const result = await authService.refreshSession(tokenFromCookie || tokenFromBody);
  setAuthCookies(res, result.tokens);
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

/**
 * End user session by clearing auth cookies.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function logout(req, res) {
  clearAuthCookies(res);
  res.json({ success: true, message: "Signed out successfully" });
}

module.exports = {
  register,
  login,
  refresh,
  me,
  forgotPassword,
  verifyCode,
  resetPassword,
  logout,
};
