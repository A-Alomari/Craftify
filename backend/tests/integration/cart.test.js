/**
 * Integration tests for Cart endpoints
 */
const { request, app, mockDb, authHeader } = require("./setup");
const { fakeCart, fakeCartItem, fakeProduct } = require("../fixtures/users");

describe("Cart API Endpoints", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("GET /api/cart", () => {
    it("should return 200 + user's cart items", async () => {
      const product = fakeProduct({ price: 25 });
      const cart = { id: "c1", userId: "buyer_001", items: [{ id: "ci1", productId: "p1", quantity: 2, product }] };
      mockDb.cart.findUnique.mockResolvedValueOnce(cart).mockResolvedValueOnce(cart);

      const res = await request(app).get("/api/cart").set("Authorization", authHeader("buyer"));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should return 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/cart");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/cart/add", () => {
    it("should add item to cart → 201", async () => {
      mockDb.cart.findUnique.mockResolvedValue(fakeCart({ id: "c1", userId: "buyer_001" }));
      mockDb.cartItem.upsert.mockResolvedValue(fakeCartItem());

      const res = await request(app)
        .post("/api/cart/add")
        .set("Authorization", authHeader("buyer"))
        .send({ productId: "p1", quantity: 1 });

      expect(res.status).toBe(201);
    });

    it("should return 400 for missing productId", async () => {
      const res = await request(app)
        .post("/api/cart/add")
        .set("Authorization", authHeader("buyer"))
        .send({ quantity: 1 });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/cart/update", () => {
    it("should update cart item quantity → 200", async () => {
      mockDb.cart.findUnique.mockResolvedValue(fakeCart({ id: "c1", userId: "buyer_001" }));
      mockDb.cartItem.update.mockResolvedValue(fakeCartItem({ quantity: 5 }));

      const res = await request(app)
        .put("/api/cart/update")
        .set("Authorization", authHeader("buyer"))
        .send({ productId: "p1", quantity: 5 });

      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /api/cart/remove", () => {
    it("should remove item from cart → 200", async () => {
      mockDb.cart.findUnique.mockResolvedValue(fakeCart({ id: "c1", userId: "buyer_001" }));
      mockDb.cartItem.delete.mockResolvedValue({});

      const res = await request(app)
        .delete("/api/cart/remove?productId=p1")
        .set("Authorization", authHeader("buyer"));

      expect(res.status).toBe(200);
    });
  });
});
