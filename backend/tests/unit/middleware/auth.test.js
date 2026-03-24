/**
 * Unit tests for auth middleware (requireAuth, requireRole)
 */
const jwt = require("jsonwebtoken");
const { createMockReqRes } = require("../../helpers/setup");
const { TEST_ACCESS_SECRET, testUsers, generateAccessToken, generateExpiredToken } = require("../../helpers/authHelper");

// Mock the config env to use test secrets
jest.mock("../../../src/config/env", () => ({
  env: { jwtAccessSecret: "test_access_secret_key_12345" },
}));

const { requireAuth, requireRole } = require("../../../src/middleware/auth");

describe("Auth Middleware", () => {
  // ───────────────────── requireAuth ─────────────────────
  describe("requireAuth", () => {
    it("should pass with valid JWT and attach user to req.auth", () => {
      const token = generateAccessToken(testUsers.buyer);
      const { req, res, next } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.auth).toBeDefined();
      expect(req.auth.sub).toBe("buyer_001");
      expect(req.auth.role).toBe("BUYER");
    });

    it("should reject with 401 when no authorization header", () => {
      const { req, res, next } = createMockReqRes();

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401, message: expect.stringContaining("Missing") })
      );
    });

    it("should reject with 401 when schema is not Bearer", () => {
      const { req, res, next } = createMockReqRes({
        headers: { authorization: "Basic sometoken" },
      });

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it("should reject with 401 for expired token", () => {
      const token = jwt.sign(testUsers.buyer, TEST_ACCESS_SECRET, { expiresIn: "-1s" });
      const { req, res, next } = createMockReqRes({
        headers: { authorization: `Bearer ${token}` },
      });

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401, message: expect.stringContaining("Invalid or expired") })
      );
    });

    it("should reject with 401 for malformed/tampered token", () => {
      const { req, res, next } = createMockReqRes({
        headers: { authorization: "Bearer this.is.not.a.real.jwt" },
      });

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });

    it("should reject with 401 when token is empty string", () => {
      const { req, res, next } = createMockReqRes({
        headers: { authorization: "Bearer " },
      });

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });
  });

  // ───────────────────── requireRole ─────────────────────
  describe("requireRole", () => {
    it("should pass if user has the required role", () => {
      const { req, res, next } = createMockReqRes({
        auth: { sub: "u1", role: "ARTISAN" },
      });

      requireRole(["ARTISAN", "ADMIN"])(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });

    it("should reject with 403 if user role is not allowed", () => {
      const { req, res, next } = createMockReqRes({
        auth: { sub: "u1", role: "BUYER" },
      });

      requireRole(["ARTISAN", "ADMIN"])(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it("should reject buyer accessing artisan routes", () => {
      const { req, res, next } = createMockReqRes({
        auth: { sub: "u1", role: "BUYER" },
      });

      requireRole(["ARTISAN"])(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it("should reject artisan accessing admin routes", () => {
      const { req, res, next } = createMockReqRes({
        auth: { sub: "u1", role: "ARTISAN" },
      });

      requireRole(["ADMIN"])(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );
    });

    it("should allow admin to access everything", () => {
      const { req, res, next } = createMockReqRes({
        auth: { sub: "admin1", role: "ADMIN" },
      });

      requireRole(["ADMIN"])(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it("should reject with 401 if req.auth is not set", () => {
      const { req, res, next } = createMockReqRes({ auth: null });

      requireRole(["BUYER"])(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );
    });
  });
});
