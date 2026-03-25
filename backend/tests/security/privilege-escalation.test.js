/**
 * Security tests — Privilege escalation
 */
const { request, app, mockDb, authHeader } = require("../integration/setup");
const { fakeProduct, fakeOrder, fakeNotification } = require("../fixtures/users");

describe("Security — Privilege Escalation", () => {
  beforeEach(() => jest.clearAllMocks());

  // ───── Vertical privilege escalation ─────
  describe("Vertical escalation (buyer → artisan/admin)", () => {
    it("buyer cannot create products (artisan route)", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", authHeader("buyer"))
        .send({ name: "X", description: "Test desc", price: 10, categoryId: "c1", imageUrls: ["https://x.com/i.jpg"] });
      expect(res.status).toBe(403);
    });

    it("buyer cannot create auctions (artisan route)", async () => {
      const res = await request(app)
        .post("/api/auctions")
        .set("Authorization", authHeader("buyer"))
        .send({ productId: "p1", startingBid: 10, bidIncrement: 1, startAt: new Date().toISOString(), endAt: new Date().toISOString() });
      expect(res.status).toBe(403);
    });

    it("buyer cannot access admin dashboard", async () => {
      const res = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", authHeader("buyer"));
      expect(res.status).toBe(403);
    });

    it("buyer cannot list admin users", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", authHeader("buyer"));
      expect(res.status).toBe(403);
    });

    it("buyer cannot view admin orders", async () => {
      const res = await request(app)
        .get("/api/admin/orders")
        .set("Authorization", authHeader("buyer"));
      expect(res.status).toBe(403);
    });

    it("buyer cannot update users as admin", async () => {
      const res = await request(app)
        .put("/api/admin/users/u1")
        .set("Authorization", authHeader("buyer"))
        .send({ role: "ADMIN" });
      expect(res.status).toBe(403);
    });

    it("artisan cannot access admin dashboard", async () => {
      const res = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", authHeader("artisan"));
      expect(res.status).toBe(403);
    });

    it("artisan cannot access admin user list", async () => {
      const res = await request(app)
        .get("/api/admin/users")
        .set("Authorization", authHeader("artisan"));
      expect(res.status).toBe(403);
    });

    it("buyer accessing artisan dashboard gets 403", async () => {
      const res = await request(app)
        .get("/api/artisan/dashboard")
        .set("Authorization", authHeader("buyer"));
      expect(res.status).toBe(403);
    });
  });

  // ───── Horizontal privilege escalation ─────
  describe("Horizontal escalation (user A → user B data)", () => {
    it("user cannot view another user's order", async () => {
      mockDb.order.findUnique.mockResolvedValue(fakeOrder({ userId: "other_user" }));

      const res = await request(app)
        .get("/api/orders/o1")
        .set("Authorization", authHeader("buyer"));
      expect(res.status).toBe(403);
    });

    it("user cannot mark another user's notification as read", async () => {
      mockDb.notification.findUnique.mockResolvedValue(fakeNotification({ userId: "other_user" }));

      const res = await request(app)
        .put("/api/notifications/n1/read")
        .set("Authorization", authHeader("buyer"));
      expect(res.status).toBe(403);
    });

    it("artisan cannot update another artisan's product", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ artisanId: "other_artisan" }));

      const res = await request(app)
        .put("/api/products/p1")
        .set("Authorization", authHeader("artisan"))
        .send({ name: "hijacked" });
      expect(res.status).toBe(403);
    });

    it("artisan cannot delete another artisan's product", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ artisanId: "other_artisan" }));

      const res = await request(app)
        .delete("/api/products/p1")
        .set("Authorization", authHeader("artisan"));
      expect(res.status).toBe(403);
    });

    it("user cannot read messages from conversations they're not part of", async () => {
      mockDb.conversationParticipant.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/messages/conv1")
        .set("Authorization", authHeader("buyer"));
      expect(res.status).toBe(403);
    });
  });
});
