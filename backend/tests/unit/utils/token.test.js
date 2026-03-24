/**
 * Unit tests for token utilities
 */
const jwt = require("jsonwebtoken");

jest.mock("../../../src/config/env", () => ({
  env: {
    jwtAccessSecret: "test_access_secret_key_12345",
    jwtRefreshSecret: "test_refresh_secret_key_67890",
    accessTokenTtl: "15m",
    refreshTokenTtl: "7d",
  },
}));

const { signAccessToken, signRefreshToken } = require("../../../src/utils/token");

describe("Token Utils", () => {
  const payload = { sub: "user_1", role: "BUYER", email: "test@test.com" };

  describe("signAccessToken", () => {
    it("should return a valid JWT string", () => {
      const token = signAccessToken(payload);

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should contain correct payload when decoded", () => {
      const token = signAccessToken(payload);
      const decoded = jwt.verify(token, "test_access_secret_key_12345");

      expect(decoded.sub).toBe("user_1");
      expect(decoded.role).toBe("BUYER");
      expect(decoded.email).toBe("test@test.com");
    });

    it("should set expiration", () => {
      const token = signAccessToken(payload);
      const decoded = jwt.decode(token);

      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeGreaterThan(decoded.iat);
    });

    it("should fail verification with wrong secret", () => {
      const token = signAccessToken(payload);

      expect(() => jwt.verify(token, "wrong_secret")).toThrow();
    });
  });

  describe("signRefreshToken", () => {
    it("should return a valid JWT string", () => {
      const token = signRefreshToken(payload);

      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("should be verifiable with refresh secret", () => {
      const token = signRefreshToken(payload);
      const decoded = jwt.verify(token, "test_refresh_secret_key_67890");

      expect(decoded.sub).toBe("user_1");
    });

    it("should not be verifiable with access secret", () => {
      const token = signRefreshToken(payload);

      expect(() => jwt.verify(token, "test_access_secret_key_12345")).toThrow();
    });
  });
});
