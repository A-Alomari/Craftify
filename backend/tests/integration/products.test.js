/**
 * Integration tests for Products endpoints
 */
const { request, app, mockDb, authHeader } = require("./setup");
const { fakeProduct } = require("../fixtures/users");

describe("Products API Endpoints", () => {
  beforeEach(() => jest.clearAllMocks());

  // ───── GET /api/products ─────
  describe("GET /api/products", () => {
    it("should return 200 + paginated product list", async () => {
      mockDb.product.findMany.mockResolvedValue([fakeProduct()]);
      mockDb.product.count.mockResolvedValue(1);

      const res = await request(app).get("/api/products");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.items).toBeDefined();
      expect(res.body.total).toBe(1);
    });

    it("should support search query", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);

      const res = await request(app).get("/api/products?q=handmade");

      expect(res.status).toBe(200);
    });

    it("should support pagination", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);

      const res = await request(app).get("/api/products?page=2&pageSize=5");

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(2);
    });
  });

  // ───── GET /api/products/:id ─────
  describe("GET /api/products/:id", () => {
    it("should return 200 + product detail", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ id: "p1" }));

      const res = await request(app).get("/api/products/p1");

      expect(res.status).toBe(200);
      expect(res.body.product).toBeDefined();
    });

    it("should return 404 for non-existent product", async () => {
      mockDb.product.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/api/products/nonexistent");

      expect(res.status).toBe(404);
    });
  });

  // ───── POST /api/products ─────
  describe("POST /api/products", () => {
    const validProduct = {
      name: "Handmade Vase",
      description: "A beautiful handmade ceramic vase",
      price: 49.99,
      stock: 10,
      categoryId: "cat1",
      imageUrls: ["https://example.com/img.jpg"],
    };

    it("should create product as artisan → 201", async () => {
      mockDb.product.create.mockResolvedValue(fakeProduct({ ...validProduct, artisanId: "artisan_001" }));

      const res = await request(app)
        .post("/api/products")
        .set("Authorization", authHeader("artisan"))
        .send(validProduct);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it("should return 403 when buyer tries to create", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", authHeader("buyer"))
        .send(validProduct);

      expect(res.status).toBe(403);
    });

    it("should return 401 when unauthenticated", async () => {
      const res = await request(app)
        .post("/api/products")
        .send(validProduct);

      expect(res.status).toBe(401);
    });

    it("should return 400 for missing required fields", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", authHeader("artisan"))
        .send({ name: "X" });

      expect(res.status).toBe(400);
    });
  });

  // ───── PUT /api/products/:id ─────
  describe("PUT /api/products/:id", () => {
    it("should update own product as artisan → 200", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ id: "p1", artisanId: "artisan_001" }));
      mockDb.product.update.mockResolvedValue(fakeProduct({ id: "p1", name: "Updated" }));

      const res = await request(app)
        .put("/api/products/p1")
        .set("Authorization", authHeader("artisan"))
        .send({ name: "Updated" });

      expect(res.status).toBe(200);
    });

    it("should return 403 when updating another artisan's product", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ id: "p1", artisanId: "other_artisan" }));

      const res = await request(app)
        .put("/api/products/p1")
        .set("Authorization", authHeader("artisan"))
        .send({ name: "Stolen" });

      expect(res.status).toBe(403);
    });
  });

  // ───── DELETE /api/products/:id ─────
  describe("DELETE /api/products/:id", () => {
    it("should delete own product as artisan → 200", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ id: "p1", artisanId: "artisan_001" }));
      mockDb.product.delete.mockResolvedValue({});

      const res = await request(app)
        .delete("/api/products/p1")
        .set("Authorization", authHeader("artisan"));

      expect(res.status).toBe(200);
    });

    it("should allow admin to delete any product → 200", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ id: "p1", artisanId: "other" }));
      mockDb.product.delete.mockResolvedValue({});

      const res = await request(app)
        .delete("/api/products/p1")
        .set("Authorization", authHeader("admin"));

      expect(res.status).toBe(200);
    });

    it("should return 403 when deleting another's product", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ artisanId: "other" }));

      const res = await request(app)
        .delete("/api/products/p1")
        .set("Authorization", authHeader("artisan"));

      expect(res.status).toBe(403);
    });
  });
});
