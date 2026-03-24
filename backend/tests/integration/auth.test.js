/**
 * Integration tests for Auth endpoints
 */
const { request, app, mockDb, authHeader, testUsers } = require("./setup");
const bcrypt = require("bcryptjs");
const { fakeUser } = require("../fixtures/users");

describe("Auth API Endpoints", () => {
  beforeEach(() => jest.clearAllMocks());

  // ───── POST /api/auth/register ─────
  describe("POST /api/auth/register", () => {
    it("should register a new user → 201 + token", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      mockDb.user.create.mockResolvedValue({ id: "u1", fullName: "Alice", email: "alice@test.com", role: "BUYER" });

      const res = await request(app)
        .post("/api/auth/register")
        .send({ fullName: "Alice", email: "alice@test.com", password: "password123" });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.tokens).toBeDefined();
      expect(res.body.user.email).toBe("alice@test.com");
    });

    it("should return 409 for duplicate email", async () => {
      mockDb.user.findUnique.mockResolvedValue(fakeUser());

      const res = await request(app)
        .post("/api/auth/register")
        .send({ fullName: "Alice", email: "dup@test.com", password: "password123" });

      expect(res.status).toBe(409);
    });

    it("should return 400 for missing fields", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ email: "a@b.com" });

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid email format", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ fullName: "Alice", email: "not-email", password: "password123" });

      expect(res.status).toBe(400);
    });

    it("should return 400 for short password (<8 chars)", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ fullName: "Alice", email: "a@b.com", password: "short" });

      expect(res.status).toBe(400);
    });
  });

  // ───── POST /api/auth/login ─────
  describe("POST /api/auth/login", () => {
    it("should login with valid credentials → 200 + token", async () => {
      const hash = await bcrypt.hash("correct", 10);
      mockDb.user.findUnique.mockResolvedValue(
        fakeUser({ id: "u1", email: "bob@test.com", passwordHash: hash, fullName: "Bob", role: "BUYER" })
      );

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "bob@test.com", password: "correct" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tokens).toBeDefined();
    });

    it("should return 401 for wrong password", async () => {
      const hash = await bcrypt.hash("correct", 10);
      mockDb.user.findUnique.mockResolvedValue(fakeUser({ passwordHash: hash }));

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "bob@test.com", password: "wrong" });

      expect(res.status).toBe(401);
    });

    it("should return 401 for non-existent email", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "nobody@test.com", password: "pass" });

      expect(res.status).toBe(401);
    });

    it("should return 400 for missing fields", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ───── GET /api/auth/me ─────
  describe("GET /api/auth/me", () => {
    it("should return current user when authenticated → 200", async () => {
      mockDb.user.findUnique.mockResolvedValue({
        id: "buyer_001",
        fullName: "Buyer",
        email: "buyer@test.com",
        role: "BUYER",
        avatarUrl: null,
        bio: null,
      });

      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", authHeader("buyer"));

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("buyer@test.com");
    });

    it("should return 401 without token", async () => {
      const res = await request(app).get("/api/auth/me");

      expect(res.status).toBe(401);
    });
  });

  // ───── POST /api/auth/forgot-password ─────
  describe("POST /api/auth/forgot-password", () => {
    it("should return 200 with generic message for valid email", async () => {
      mockDb.user.findUnique.mockResolvedValue(fakeUser());

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "user@test.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain("verification code");
    });

    it("should return 200 for non-existent email (no leak)", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "none@test.com" });

      expect(res.status).toBe(200);
    });
  });

  // ───── POST /api/auth/verify-code ─────
  describe("POST /api/auth/verify-code", () => {
    it("should return 400 for missing email or code", async () => {
      const res = await request(app)
        .post("/api/auth/verify-code")
        .send({ email: "", code: "" });

      expect(res.status).toBe(400);
    });

    it("should return 400 for invalid code when no reset was requested", async () => {
      const res = await request(app)
        .post("/api/auth/verify-code")
        .send({ email: "test@test.com", code: "000000" });

      expect(res.status).toBe(400);
    });
  });

  // ───── POST /api/auth/reset-password ─────
  describe("POST /api/auth/reset-password", () => {
    it("should return 400 for missing fields", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ email: "", password: "" });

      expect(res.status).toBe(400);
    });

    it("should return 400 for short password", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ email: "test@test.com", password: "short" });

      expect(res.status).toBe(400);
    });

    it("should return 400 when code not verified first", async () => {
      const res = await request(app)
        .post("/api/auth/reset-password")
        .send({ email: "test@test.com", password: "longpassword123" });

      expect(res.status).toBe(400);
    });
  });
});
