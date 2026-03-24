const bcrypt = require("bcryptjs");
const { db } = require("../models");
const { signAccessToken, signRefreshToken } = require("../utils/token");
const { ConflictError, UnauthorizedError, NotFoundError, ValidationError } = require("../utils/http");
const { sendEmail } = require("./email.service");

const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const VERIFIED_RESET_TTL_MS = 10 * 60 * 1000;
const passwordResetStore = new Map();

function generateSixDigitCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Register a new user and issue access/refresh tokens.
 * @param {{fullName: string, email: string, password: string, role?: "BUYER"|"ARTISAN"|"ADMIN"}} data
 * @returns {Promise<{user: {id: string, fullName: string, email: string, role: string}, tokens: {accessToken: string, refreshToken: string}}>} 
 */
async function register(data) {
  const { fullName, email, password, role } = data;
  const exists = await db.user.findUnique({ where: { email } });
  if (exists) {
    throw new ConflictError("Email is already registered");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: { fullName, email, passwordHash, role },
    select: { id: true, fullName: true, email: true, role: true },
  });

  const payload = { sub: user.id, role: user.role, email: user.email };
  return {
    user,
    tokens: {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    },
  };
}

/**
 * Authenticate a user and issue access/refresh tokens.
 * @param {{email: string, password: string}} data
 * @returns {Promise<{user: {id: string, fullName: string, email: string, role: string}, tokens: {accessToken: string, refreshToken: string}}>} 
 */
async function login(data) {
  const { email, password } = data;
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const payload = { sub: user.id, role: user.role, email: user.email };

  return {
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
    tokens: {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
    },
  };
}

/**
 * Fetch the public profile for a user id.
 * @param {string} userId
 * @returns {Promise<{id: string, fullName: string, email: string, role: string, avatarUrl: string|null, bio: string|null}>}
 */
async function getCurrentUser(userId) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      avatarUrl: true,
      bio: true,
    },
  });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
}

/**
 * Request a password reset code for an email address.
 * @param {{ email: string }} data
 * @returns {Promise<{message: string}>}
 */
async function forgotPassword(data) {
  const email = String(data.email || "").trim().toLowerCase();
  if (!email) {
    throw new ValidationError("Email is required");
  }

  const user = await db.user.findUnique({ where: { email } });

  // Avoid user enumeration by returning a generic success response.
  if (!user) {
    return { message: "If the account exists, a verification code has been sent." };
  }

  const code = generateSixDigitCode();
  const codeHash = await bcrypt.hash(code, 10);

  passwordResetStore.set(email, {
    codeHash,
    expiresAt: Date.now() + RESET_CODE_TTL_MS,
    verifiedUntil: 0,
  });

  await sendEmail({
    to: email,
    subject: "Craftify password reset code",
    text: `Your verification code is ${code}. It expires in 10 minutes.`,
  });

  return { message: "If the account exists, a verification code has been sent." };
}

/**
 * Verify an emailed reset code.
 * @param {{ email: string, code: string }} data
 * @returns {Promise<{message: string}>}
 */
async function verifyCode(data) {
  const email = String(data.email || "").trim().toLowerCase();
  const code = String(data.code || "").trim();

  if (!email || !code) {
    throw new ValidationError("Email and code are required");
  }

  const resetState = passwordResetStore.get(email);
  if (!resetState || resetState.expiresAt < Date.now()) {
    passwordResetStore.delete(email);
    throw new ValidationError("Verification code is invalid or expired");
  }

  const isValidCode = await bcrypt.compare(code, resetState.codeHash);
  if (!isValidCode) {
    throw new ValidationError("Verification code is invalid or expired");
  }

  resetState.verifiedUntil = Date.now() + VERIFIED_RESET_TTL_MS;
  passwordResetStore.set(email, resetState);

  return { message: "Verification successful" };
}

/**
 * Reset a password after successful code verification.
 * @param {{ email: string, password: string }} data
 * @returns {Promise<{message: string}>}
 */
async function resetPassword(data) {
  const email = String(data.email || "").trim().toLowerCase();
  const password = String(data.password || "");

  if (!email || !password) {
    throw new ValidationError("Email and password are required");
  }
  if (password.length < 8) {
    throw new ValidationError("Password must be at least 8 characters");
  }

  const resetState = passwordResetStore.get(email);
  if (!resetState || resetState.verifiedUntil < Date.now()) {
    throw new ValidationError("Please verify your reset code before changing password");
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    // Keep response generic while still allowing the flow to terminate safely.
    passwordResetStore.delete(email);
    return { message: "Password has been reset successfully" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.update({
    where: { email },
    data: { passwordHash },
  });

  passwordResetStore.delete(email);

  return { message: "Password has been reset successfully" };
}

module.exports = {
  register,
  login,
  getCurrentUser,
  forgotPassword,
  verifyCode,
  resetPassword,
};
