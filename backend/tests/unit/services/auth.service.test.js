/**
 * Unit tests for auth.service.js
 */
const bcrypt = require("bcryptjs");

// Mock the models layer
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

// Mock token utils
jest.mock("../../../src/utils/token", () => ({
  signAccessToken: jest.fn(() => "mock_access_token"),
  signRefreshToken: jest.fn(() => "mock_refresh_token"),
}));

// Mock email service
jest.mock("../../../src/services/email.service", () => ({
  sendEmail: jest.fn(() => Promise.resolve({ queued: true })),
}));

const authService = require("../../../src/services/auth.service");
const { signAccessToken, signRefreshToken } = require("../../../src/utils/token");
const { sendEmail } = require("../../../src/services/email.service");

const { fakeUser } = require("../../fixtures/users");

describe("Auth Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ───────────────────── register ─────────────────────
  describe("register", () => {
    it("should create a new user and return tokens", async () => {
      const userData = { fullName: "Alice", email: "alice@test.com", password: "password123", role: "BUYER" };
      const createdUser = { id: "u1", fullName: "Alice", email: "alice@test.com", role: "BUYER" };

      mockDb.user.findUnique.mockResolvedValue(null);
      mockDb.user.create.mockResolvedValue(createdUser);

      const result = await authService.register(userData);

      expect(mockDb.user.findUnique).toHaveBeenCalledWith({ where: { email: "alice@test.com" } });
      expect(mockDb.user.create).toHaveBeenCalledTimes(1);
      expect(result.user).toEqual(createdUser);
      expect(result.tokens.accessToken).toBe("mock_access_token");
      expect(result.tokens.refreshToken).toBe("mock_refresh_token");
      expect(signAccessToken).toHaveBeenCalledWith({ sub: "u1", role: "BUYER", email: "alice@test.com" });
    });

    it("should hash the password before saving", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      mockDb.user.create.mockResolvedValue({ id: "u1", fullName: "A", email: "a@t.com", role: "BUYER" });

      await authService.register({ fullName: "A", email: "a@t.com", password: "mypassword", role: "BUYER" });

      const createCall = mockDb.user.create.mock.calls[0][0];
      expect(createCall.data.passwordHash).toBeDefined();
      // Bcrypt hashes start with $2b$ or $2a$
      expect(createCall.data.passwordHash).toMatch(/^\$2[ab]\$/);
      expect(createCall.data.passwordHash).not.toBe("mypassword");
    });

    it("should throw ConflictError if email already exists", async () => {
      mockDb.user.findUnique.mockResolvedValue(fakeUser());

      await expect(
        authService.register({ fullName: "A", email: "dup@test.com", password: "password123" })
      ).rejects.toThrow("Email is already registered");
    });
  });

  // ───────────────────── login ─────────────────────
  describe("login", () => {
    it("should return user and tokens for valid credentials", async () => {
      const hash = await bcrypt.hash("correctpassword", 10);
      const user = fakeUser({ id: "u2", email: "bob@test.com", passwordHash: hash, fullName: "Bob", role: "BUYER" });
      mockDb.user.findUnique.mockResolvedValue(user);

      const result = await authService.login({ email: "bob@test.com", password: "correctpassword" });

      expect(result.user.id).toBe("u2");
      expect(result.user.email).toBe("bob@test.com");
      expect(result.tokens.accessToken).toBe("mock_access_token");
      expect(result.tokens.refreshToken).toBe("mock_refresh_token");
    });

    it("should throw UnauthorizedError for non-existent email", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: "nobody@test.com", password: "pass" })
      ).rejects.toThrow("Invalid email or password");
    });

    it("should throw UnauthorizedError for wrong password", async () => {
      const hash = await bcrypt.hash("correctpassword", 10);
      mockDb.user.findUnique.mockResolvedValue(fakeUser({ passwordHash: hash }));

      await expect(
        authService.login({ email: "x@test.com", password: "wrongpassword" })
      ).rejects.toThrow("Invalid email or password");
    });
  });

  // ───────────────────── getCurrentUser ─────────────────────
  describe("getCurrentUser", () => {
    it("should return user profile for valid id", async () => {
      const user = { id: "u3", fullName: "C", email: "c@t.com", role: "BUYER", avatarUrl: null, bio: null };
      mockDb.user.findUnique.mockResolvedValue(user);

      const result = await authService.getCurrentUser("u3");
      expect(result).toEqual(user);
    });

    it("should throw NotFoundError if user does not exist", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      await expect(authService.getCurrentUser("bad_id")).rejects.toThrow("User not found");
    });
  });

  // ───────────────────── forgotPassword ─────────────────────
  describe("forgotPassword", () => {
    it("should return generic message for existing email and send email", async () => {
      mockDb.user.findUnique.mockResolvedValue(fakeUser({ email: "exists@test.com" }));

      const result = await authService.forgotPassword({ email: "exists@test.com" });

      expect(result.message).toContain("verification code has been sent");
      expect(sendEmail).toHaveBeenCalledTimes(1);
    });

    it("should return generic message for non-existent email (no leak)", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      const result = await authService.forgotPassword({ email: "nonexistent@test.com" });

      expect(result.message).toContain("verification code has been sent");
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("should throw ValidationError if email is empty", async () => {
      await expect(authService.forgotPassword({ email: "" })).rejects.toThrow("Email is required");
    });
  });

  // ───────────────────── verifyCode ─────────────────────
  describe("verifyCode", () => {
    it("should throw ValidationError if email or code is missing", async () => {
      await expect(authService.verifyCode({ email: "", code: "" })).rejects.toThrow("Email and code are required");
    });

    it("should throw ValidationError for invalid/expired code", async () => {
      await expect(authService.verifyCode({ email: "x@test.com", code: "000000" })).rejects.toThrow(
        "Verification code is invalid or expired"
      );
    });
  });

  // ───────────────────── resetPassword ─────────────────────
  describe("resetPassword", () => {
    it("should throw ValidationError if email or password is missing", async () => {
      await expect(authService.resetPassword({ email: "", password: "" })).rejects.toThrow(
        "Email and password are required"
      );
    });

    it("should throw ValidationError if password is shorter than 8 chars", async () => {
      await expect(authService.resetPassword({ email: "x@test.com", password: "short" })).rejects.toThrow(
        "Password must be at least 8 characters"
      );
    });

    it("should throw ValidationError when no verified code exists", async () => {
      await expect(authService.resetPassword({ email: "x@test.com", password: "longpassword" })).rejects.toThrow(
        "Please verify your reset code"
      );
    });
  });
});
