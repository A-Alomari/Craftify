/**
 * Auth test helpers — generate valid JWT tokens for different user roles.
 */
const jwt = require("jsonwebtoken");

const TEST_ACCESS_SECRET = "test_access_secret_key_12345";
const TEST_REFRESH_SECRET = "test_refresh_secret_key_67890";

const testUsers = {
  buyer: { sub: "buyer_001", role: "BUYER", email: "buyer@test.com" },
  artisan: { sub: "artisan_001", role: "ARTISAN", email: "artisan@test.com" },
  admin: { sub: "admin_001", role: "ADMIN", email: "admin@test.com" },
};

function generateAccessToken(payload = testUsers.buyer, expiresIn = "15m") {
  return jwt.sign(payload, TEST_ACCESS_SECRET, { expiresIn });
}

function generateRefreshToken(payload = testUsers.buyer, expiresIn = "7d") {
  return jwt.sign(payload, TEST_REFRESH_SECRET, { expiresIn });
}

function generateExpiredToken(payload = testUsers.buyer) {
  return jwt.sign(payload, TEST_ACCESS_SECRET, { expiresIn: "0s" });
}

function authHeader(role = "buyer") {
  const token = generateAccessToken(testUsers[role]);
  return `Bearer ${token}`;
}

module.exports = {
  TEST_ACCESS_SECRET,
  TEST_REFRESH_SECRET,
  testUsers,
  generateAccessToken,
  generateRefreshToken,
  generateExpiredToken,
  authHeader,
};
