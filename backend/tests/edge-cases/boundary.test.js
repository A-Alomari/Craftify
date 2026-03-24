/**
 * Phase 10: Edge Cases & Boundary Tests
 * Tests for race conditions, boundary values, deleted resources, unicode, etc.
 */
const { request, app, mockDb, authHeader } = require("../integration/setup");
const { fakeProduct, fakeAuction, fakeOrder, fakeUser, fakeCartItem } = require("../fixtures/users");

describe("Phase 10: Edge Cases & Boundary Tests", () => {
  beforeEach(() => jest.clearAllMocks());

  // ═══════════════════════════════════════════════════════════
  // BOUNDARY VALUES
  // ═══════════════════════════════════════════════════════════
  describe("Boundary Values", () => {
    it("product with price 0 should be rejected", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", authHeader("artisan"))
        .send({ name: "Free Item", description: "Zero price product", price: 0, categoryId: "c1", imageUrls: ["https://x.com/i.jpg"] });
      expect(res.status).toBe(400);
    });

    it("product with extremely high price should be accepted", async () => {
      mockDb.product.create.mockResolvedValue(fakeProduct({ price: 999999.99 }));
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", authHeader("artisan"))
        .send({ name: "Luxury Item", description: "Very expensive handcrafted art", price: 999999.99, categoryId: "c1", imageUrls: ["https://x.com/i.jpg"] });
      expect(res.status).toBe(201);
    });

    it("review with rating 1 (minimum) should be accepted", async () => {
      mockDb.review.upsert.mockResolvedValue({ id: "r1", rating: 1 });
      const res = await request(app)
        .post("/api/reviews")
        .set("Authorization", authHeader("buyer"))
        .send({ productId: "p1", rating: 1, body: "Not great at all unfortunately" });
      expect(res.status).toBe(201);
    });

    it("review with rating 5 (maximum) should be accepted", async () => {
      mockDb.review.upsert.mockResolvedValue({ id: "r1", rating: 5 });
      const res = await request(app)
        .post("/api/reviews")
        .set("Authorization", authHeader("buyer"))
        .send({ productId: "p1", rating: 5, body: "Absolutely wonderful craftsmanship" });
      expect(res.status).toBe(201);
    });

    it("review with rating 0 (below minimum) should be rejected", async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set("Authorization", authHeader("buyer"))
        .send({ productId: "p1", rating: 0, body: "Zero rating test" });
      expect(res.status).toBe(400);
    });

    it("review with rating 6 (above maximum) should be rejected", async () => {
      const res = await request(app)
        .post("/api/reviews")
        .set("Authorization", authHeader("buyer"))
        .send({ productId: "p1", rating: 6, body: "Above max test" });
      expect(res.status).toBe(400);
    });

    it("bid with negative amount should be rejected", async () => {
      const res = await request(app)
        .post("/api/auctions/auc1/bid")
        .set("Authorization", authHeader("buyer"))
        .send({ amount: -5 });
      expect(res.status).toBe(400);
    });

    it("cart quantity of 0 should be rejected", async () => {
      const res = await request(app)
        .post("/api/cart/add")
        .set("Authorization", authHeader("buyer"))
        .send({ productId: "p1", quantity: 0 });
      expect(res.status).toBe(400);
    });

    it("password exactly 8 characters should be accepted", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      mockDb.user.create.mockResolvedValue({ id: "u1", fullName: "Test", email: "t@t.com", role: "BUYER" });
      const res = await request(app)
        .post("/api/auth/register")
        .send({ fullName: "Test", email: "t@t.com", password: "12345678" });
      expect(res.status).toBe(201);
    });

    it("password with 7 characters should be rejected", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({ fullName: "Test", email: "t@t.com", password: "1234567" });
      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // UNICODE & SPECIAL CHARACTERS
  // ═══════════════════════════════════════════════════════════
  describe("Unicode & Special Characters", () => {
    it("should accept unicode in user fullName (Arabic)", async () => {
      mockDb.user.findUnique.mockResolvedValue(null);
      mockDb.user.create.mockResolvedValue({ id: "u1", fullName: "محمد أحمد", email: "arabic@test.com", role: "BUYER" });
      const res = await request(app)
        .post("/api/auth/register")
        .send({ fullName: "محمد أحمد", email: "arabic@test.com", password: "password123" });
      expect(res.status).toBe(201);
    });

    it("should accept emoji in contact message", async () => {
      mockDb.contactMessage.create.mockResolvedValue({ id: "c1" });
      const res = await request(app)
        .post("/api/contact")
        .send({ name: "Test 😀", email: "test@t.com", message: "I love your products! 🎉🎨" });
      expect(res.status).toBe(201);
    });

    it("should accept unicode in review body (Japanese)", async () => {
      mockDb.review.upsert.mockResolvedValue({ id: "r1" });
      const res = await request(app)
        .post("/api/reviews")
        .set("Authorization", authHeader("buyer"))
        .send({ productId: "p1", rating: 5, body: "素晴らしい手作りの花瓶！品質がとても高いです。" });
      expect(res.status).toBe(201);
    });

    it("should accept special characters in search query", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.user.findMany.mockResolvedValue([]);
      const res = await request(app).get("/api/search?q=hand-made%20%26%20craft");
      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // EXTREMELY LONG INPUT
  // ═══════════════════════════════════════════════════════════
  describe("Extremely Long Input Strings", () => {
    it("should handle very long product name", async () => {
      const longName = "A".repeat(500);
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", authHeader("artisan"))
        .send({ name: longName, description: "Test", price: 10, categoryId: "c1", imageUrls: ["https://x.com/i.jpg"] });
      // Should either accept (if no length limit) or reject — not crash
      expect([201, 400]).toContain(res.status);
    });

    it("should handle very long email in registration", async () => {
      const longEmail = "a".repeat(300) + "@test.com";
      const res = await request(app)
        .post("/api/auth/register")
        .send({ fullName: "Test", email: longEmail, password: "password123" });
      expect([400, 201]).toContain(res.status);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // DELETED / NON-EXISTENT RESOURCES
  // ═══════════════════════════════════════════════════════════
  describe("Deleted / Non-Existent Resources", () => {
    it("GET non-existent product → 404", async () => {
      mockDb.product.findUnique.mockResolvedValue(null);
      const res = await request(app).get("/api/products/deleted_product_id");
      expect(res.status).toBe(404);
    });

    it("GET non-existent auction → 404", async () => {
      mockDb.auction.findUnique.mockResolvedValue(null);
      const res = await request(app).get("/api/auctions/deleted_auction_id");
      expect(res.status).toBe(404);
    });

    it("GET non-existent order → 404 or 403", async () => {
      mockDb.order.findUnique.mockResolvedValue(null);
      const res = await request(app).get("/api/orders/deleted_order_id").set("Authorization", authHeader("buyer"));
      expect([404, 403]).toContain(res.status);
    });

    it("updating non-existent product → 404", async () => {
      mockDb.product.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .put("/api/products/nonexistent")
        .set("Authorization", authHeader("artisan"))
        .send({ name: "Ghost Product" });
      expect(res.status).toBe(404);
    });

    it("deleting non-existent product → 404", async () => {
      mockDb.product.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .delete("/api/products/nonexistent")
        .set("Authorization", authHeader("artisan"));
      expect(res.status).toBe(404);
    });

    it("bidding on non-existent auction → 404", async () => {
      mockDb.auction.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post("/api/auctions/nonexistent/bid")
        .set("Authorization", authHeader("buyer"))
        .send({ amount: 100 });
      expect(res.status).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // EXPIRED AUCTION BIDS
  // ═══════════════════════════════════════════════════════════
  describe("Auction Edge Cases", () => {
    it("bid on ended auction → 400", async () => {
      const endedAuction = fakeAuction({ id: "auc_ended", status: "ENDED", endAt: new Date(Date.now() - 3600000) });
      mockDb.auction.findUnique.mockResolvedValue(endedAuction);
      const res = await request(app)
        .post("/api/auctions/auc_ended/bid")
        .set("Authorization", authHeader("buyer"))
        .send({ amount: 100 });
      expect(res.status).toBe(400);
    });

    it("bid below minimum increment → 400", async () => {
      const auction = fakeAuction({ id: "auc1", currentBid: 100, bidIncrement: 10, status: "LIVE" });
      mockDb.auction.findUnique.mockResolvedValue(auction);
      const res = await request(app)
        .post("/api/auctions/auc1/bid")
        .set("Authorization", authHeader("buyer"))
        .send({ amount: 105 }); // min should be 110
      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // EMPTY CART CHECKOUT
  // ═══════════════════════════════════════════════════════════
  describe("Checkout Edge Cases", () => {
    it("checkout with empty cart → 400", async () => {
      mockDb.cart.findUnique.mockResolvedValue({ id: "c1", items: [] });
      const res = await request(app)
        .post("/api/checkout")
        .set("Authorization", authHeader("buyer"))
        .send({ shippingName: "J", shippingEmail: "j@t.com", shippingStreet: "1 St", shippingCity: "NYC", shippingState: "NY", shippingZip: "10001" });
      expect(res.status).toBe(400);
    });

    it("checkout with null cart → 400", async () => {
      mockDb.cart.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .post("/api/checkout")
        .set("Authorization", authHeader("buyer"))
        .send({ shippingName: "J", shippingEmail: "j@t.com", shippingStreet: "1 St", shippingCity: "NYC", shippingState: "NY", shippingZip: "10001" });
      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // DUPLICATE OPERATIONS
  // ═══════════════════════════════════════════════════════════
  describe("Duplicate Operations", () => {
    it("registering with existing email → 409", async () => {
      mockDb.user.findUnique.mockResolvedValue(fakeUser());
      const res = await request(app)
        .post("/api/auth/register")
        .send({ fullName: "Dup", email: "exists@test.com", password: "password123" });
      expect(res.status).toBe(409);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // CONTENT-TYPE EDGE CASES
  // ═══════════════════════════════════════════════════════════
  describe("Content-Type Edge Cases", () => {
    it("sending form data to JSON endpoint should be handled", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/x-www-form-urlencoded")
        .send("email=test@test.com&password=password123");
      // Should either process or reject, not crash
      expect([200, 400, 401, 415]).toContain(res.status);
    });

    it("sending empty body to login should return 400", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .set("Content-Type", "application/json")
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // PAGINATION EDGE CASES
  // ═══════════════════════════════════════════════════════════
  describe("Pagination Edge Cases", () => {
    it("page 0 should be handled gracefully", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);
      const res = await request(app).get("/api/products?page=0");
      expect([200, 400]).toContain(res.status);
    });

    it("negative page should be handled", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);
      const res = await request(app).get("/api/products?page=-1");
      expect([200, 400]).toContain(res.status);
    });

    it("very large page number should return empty results", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);
      const res = await request(app).get("/api/products?page=99999");
      expect(res.status).toBe(200);
    });
  });
});
