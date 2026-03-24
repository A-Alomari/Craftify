/**
 * Security tests — Auth bypass attempts
 */
const jwt = require("jsonwebtoken");
const { request, app, mockDb } = require("../integration/setup");
const { TEST_ACCESS_SECRET, testUsers, generateAccessToken } = require("../helpers/authHelper");

describe("Security — Auth Bypass", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("Expired tokens", () => {
    it("should reject expired token on protected routes", async () => {
      const expiredToken = jwt.sign(testUsers.buyer, TEST_ACCESS_SECRET, { expiresIn: "-1s" });

      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe("Tampered tokens", () => {
    it("should reject token signed with wrong secret", async () => {
      const tamperedToken = jwt.sign(testUsers.buyer, "wrong_secret", { expiresIn: "15m" });

      const res = await request(app)
        .get("/api/orders")
        .set("Authorization", `Bearer ${tamperedToken}`);

      expect(res.status).toBe(401);
    });

    it("should reject completely invalid token", async () => {
      const res = await request(app)
        .get("/api/notifications")
        .set("Authorization", "Bearer not.a.real.jwt.token");

      expect(res.status).toBe(401);
    });

    it("should reject token with modified payload", async () => {
      // Create a token, then manually tamper with the payload
      const token = generateAccessToken(testUsers.buyer);
      const parts = token.split(".");
      // Tamper the payload
      parts[1] = Buffer.from(JSON.stringify({ sub: "admin_hack", role: "ADMIN" })).toString("base64url");
      const tampered = parts.join(".");

      const res = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", `Bearer ${tampered}`);

      expect(res.status).toBe(401);
    });
  });

  describe("Missing auth header", () => {
    const protectedRoutes = [
      { method: "get", path: "/api/cart" },
      { method: "get", path: "/api/orders" },
      { method: "get", path: "/api/wishlist" },
      { method: "get", path: "/api/notifications" },
      { method: "get", path: "/api/users/me" },
      { method: "get", path: "/api/auth/me" },
      { method: "post", path: "/api/products" },
      { method: "post", path: "/api/auctions" },
      { method: "post", path: "/api/reviews" },
      { method: "post", path: "/api/messages/send" },
      { method: "post", path: "/api/checkout" },
      { method: "get", path: "/api/admin/dashboard" },
    ];

    protectedRoutes.forEach(({ method, path }) => {
      it(`should return 401 for ${method.toUpperCase()} ${path} without auth`, async () => {
        const res = await request(app)[method](path).send({});
        expect(res.status).toBe(401);
      });
    });
  });

  describe("Auth scheme issues", () => {
    it("should reject Basic auth scheme", async () => {
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", "Basic dXNlcjpwYXNz");

      expect(res.status).toBe(401);
    });

    it("should reject empty Bearer token", async () => {
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", "Bearer ");

      expect(res.status).toBe(401);
    });

    it("should reject just 'Bearer' without token", async () => {
      const res = await request(app)
        .get("/api/cart")
        .set("Authorization", "Bearer");

      expect(res.status).toBe(401);
    });
  });
});
