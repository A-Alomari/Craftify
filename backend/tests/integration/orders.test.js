/**
 * Integration tests for Orders / Checkout endpoints
 */
const { request, app, mockDb, authHeader } = require("./setup");
const { fakeOrder, fakeProduct } = require("../fixtures/users");

describe("Orders API Endpoints", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("POST /api/checkout", () => {
    const shippingPayload = {
      shippingName: "John",
      shippingEmail: "john@test.com",
      shippingStreet: "123 Main St",
      shippingCity: "Springfield",
      shippingState: "IL",
      shippingZip: "62701",
    };

    it("should checkout with valid cart → 201", async () => {
      const product = fakeProduct({ price: 30 });
      mockDb.cart.findUnique.mockResolvedValue({
        id: "c1", userId: "buyer_001",
        items: [{ id: "ci1", productId: "p1", quantity: 2, product }],
      });
      mockDb.order.create.mockResolvedValue(fakeOrder({ totalAmount: 60, items: [] }));
      mockDb.cartItem.deleteMany.mockResolvedValue({});

      const res = await request(app)
        .post("/api/checkout")
        .set("Authorization", authHeader("buyer"))
        .send(shippingPayload);

      expect(res.status).toBe(201);
      expect(res.body.order).toBeDefined();
    });

    it("should return 400 for empty cart", async () => {
      mockDb.cart.findUnique.mockResolvedValue({ id: "c1", items: [] });

      const res = await request(app)
        .post("/api/checkout")
        .set("Authorization", authHeader("buyer"))
        .send(shippingPayload);

      expect(res.status).toBe(400);
    });

    it("should return 401 when unauthenticated", async () => {
      const res = await request(app).post("/api/checkout").send(shippingPayload);
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/orders", () => {
    it("should return user's orders → 200", async () => {
      mockDb.order.findMany.mockResolvedValue([fakeOrder()]);

      const res = await request(app).get("/api/orders").set("Authorization", authHeader("buyer"));

      expect(res.status).toBe(200);
      expect(res.body.items).toBeDefined();
    });

    it("should return 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/orders");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/orders/:id", () => {
    it("should return order detail for owner → 200", async () => {
      mockDb.order.findUnique.mockResolvedValue(fakeOrder({ id: "o1", userId: "buyer_001" }));

      const res = await request(app).get("/api/orders/o1").set("Authorization", authHeader("buyer"));

      expect(res.status).toBe(200);
    });

    it("should return 403 for another user's order", async () => {
      mockDb.order.findUnique.mockResolvedValue(fakeOrder({ id: "o1", userId: "other_user" }));

      const res = await request(app).get("/api/orders/o1").set("Authorization", authHeader("buyer"));

      expect(res.status).toBe(403);
    });

    it("should allow admin to view any order → 200", async () => {
      mockDb.order.findUnique.mockResolvedValue(fakeOrder({ id: "o1", userId: "other" }));

      const res = await request(app).get("/api/orders/o1").set("Authorization", authHeader("admin"));

      expect(res.status).toBe(200);
    });
  });

  // ───── PUT /api/orders/:id/status ─────
  describe("PUT /api/orders/:id/status", () => {
    it("should update order status as artisan → 200", async () => {
      mockDb.order.update.mockResolvedValue(fakeOrder({ id: "o1", status: "SHIPPED" }));

      const res = await request(app)
        .put("/api/orders/o1/status")
        .set("Authorization", authHeader("artisan"))
        .send({ status: "SHIPPED" });

      expect(res.status).toBe(200);
      expect(res.body.order).toBeDefined();
    });

    it("should return 403 when buyer tries to update status", async () => {
      const res = await request(app)
        .put("/api/orders/o1/status")
        .set("Authorization", authHeader("buyer"))
        .send({ status: "SHIPPED" });

      expect(res.status).toBe(403);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).put("/api/orders/o1/status").send({ status: "SHIPPED" });
      expect(res.status).toBe(401);
    });
  });

  // ───── POST /api/orders/:id/confirm ─────
  describe("POST /api/orders/:id/confirm", () => {
    it("should confirm order for owner → 200", async () => {
      mockDb.order.findUnique.mockResolvedValue(fakeOrder({ id: "o1", userId: "buyer_001" }));
      mockDb.order.update.mockResolvedValue(fakeOrder({ id: "o1", status: "DELIVERED" }));

      const res = await request(app)
        .post("/api/orders/o1/confirm")
        .set("Authorization", authHeader("buyer"));

      expect(res.status).toBe(200);
    });

    it("should return 403 for non-owner", async () => {
      mockDb.order.findUnique.mockResolvedValue(fakeOrder({ id: "o1", userId: "other_user" }));

      const res = await request(app)
        .post("/api/orders/o1/confirm")
        .set("Authorization", authHeader("buyer"));

      expect(res.status).toBe(403);
    });

    it("should return 404 for non-existent order", async () => {
      mockDb.order.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/orders/o1/confirm")
        .set("Authorization", authHeader("buyer"));

      expect(res.status).toBe(404);
    });

    it("should return 401 without auth", async () => {
      const res = await request(app).post("/api/orders/o1/confirm");
      expect(res.status).toBe(401);
    });
  });
});
