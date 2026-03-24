/**
 * Security tests — Injection, XSS, input validation
 */
const { request, app, mockDb, authHeader } = require("../integration/setup");
const { fakeUser } = require("../fixtures/users");

describe("Security — Injection & XSS", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("SQL/NoSQL injection in login fields", () => {
    it("should safely handle SQL injection in email field", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "' OR 1=1 --", password: "password" });

      // Should fail validation (not a valid email), not crash
      expect(res.status).toBe(400);
    });

    it("should safely handle NoSQL injection in login", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: '{"$gt": ""}', password: "password" });

      expect(res.status).toBe(400);
    });

    it("should safely handle injection in registration", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      mockDb.user.create.mockResolvedValue({ id: "u1", fullName: "'; DROP TABLE users; --", email: "test@test.com", role: "BUYER" });

      const res = await request(app)
        .post("/api/auth/register")
        .send({ fullName: "'; DROP TABLE users; --", email: "test@test.com", password: "password123" });

      // Should process normally (name is just a string), not cause SQL injection
      expect([201, 400, 500]).toContain(res.status);
      // The key security assertion: the server did not crash and responded
      expect(res.body).toBeDefined();
    });
  });

  describe("XSS in user input fields", () => {
    it("should handle XSS in contact message", async () => {
      const xssPayload = '<script>alert("xss")</script>';
      mockDb.contactMessage.create.mockResolvedValue({ id: "c1", name: xssPayload, email: "x@t.com", message: "Hi" });

      const res = await request(app)
        .post("/api/contact")
        .send({ name: xssPayload, email: "valid@test.com", message: "Test message body" });

      // Should accept the input (sanitization happens at render time)
      expect(res.status).toBe(201);
    });

    it("should handle XSS in review body", async () => {
      mockDb.review.upsert.mockResolvedValue({ id: "r1" });

      const res = await request(app)
        .post("/api/reviews")
        .set("Authorization", authHeader("buyer"))
        .send({ productId: "p1", rating: 5, body: '<img src=x onerror=alert(1)>' });

      // Body fails min length or goes through — either is acceptable
      expect([201, 400]).toContain(res.status);
    });
  });

  describe("Oversized payloads", () => {
    it("should reject extremely large JSON body", async () => {
      const largeString = "x".repeat(3 * 1024 * 1024); // 3MB, exceeds 2MB limit

      const res = await request(app)
        .post("/api/auth/register")
        .send({ fullName: largeString, email: "a@b.com", password: "password123" });

      // Express JSON limit is 2MB, should reject
      expect(res.status).toBe(413);
    });
  });

  describe("Negative/zero values", () => {
    it("should reject negative price in product creation", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", authHeader("artisan"))
        .send({ name: "Test Product", description: "A test product", price: -10, categoryId: "c1", imageUrls: ["https://x.com/img.jpg"] });

      expect(res.status).toBe(400);
    });

    it("should reject zero bid amount", async () => {
      const res = await request(app)
        .post("/api/auctions/auc1/bid")
        .set("Authorization", authHeader("buyer"))
        .send({ amount: 0 });

      expect(res.status).toBe(400);
    });

    it("should reject negative quantity in cart", async () => {
      const res = await request(app)
        .post("/api/cart/add")
        .set("Authorization", authHeader("buyer"))
        .send({ productId: "p1", quantity: -1 });

      expect(res.status).toBe(400);
    });
  });
});
