/**
 * Unit tests for products.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

const productsService = require("../../../src/services/products.service");
const { fakeProduct } = require("../../fixtures/users");

describe("Products Service", () => {
  beforeEach(() => jest.clearAllMocks());

  // ───────────────────── listProducts ─────────────────────
  describe("listProducts", () => {
    it("should return paginated product list", async () => {
      const products = [fakeProduct(), fakeProduct()];
      mockDb.product.findMany.mockResolvedValue(products);
      mockDb.product.count.mockResolvedValue(2);

      const result = await productsService.listProducts({ page: 1, pageSize: 12 });

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(12);
      expect(result.total).toBe(2);
      expect(result.items).toHaveLength(2);
    });

    it("should filter by categoryId when provided", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);

      await productsService.listProducts({ categoryId: "cat_1" });

      const where = mockDb.product.findMany.mock.calls[0][0].where;
      expect(where.categoryId).toBe("cat_1");
    });

    it("should apply text search when q is provided", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);

      await productsService.listProducts({ q: "handmade" });

      const where = mockDb.product.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR[0].name.contains).toBe("handmade");
    });

    it("should default to page 1 and pageSize 12", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);

      const result = await productsService.listProducts({});

      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(12);
    });

    it("should only return ACTIVE products", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.product.count.mockResolvedValue(0);

      await productsService.listProducts({});

      const where = mockDb.product.findMany.mock.calls[0][0].where;
      expect(where.status).toBe("ACTIVE");
    });
  });

  // ───────────────────── getProductById ─────────────────────
  describe("getProductById", () => {
    it("should return product for valid id", async () => {
      const product = fakeProduct({ id: "p1" });
      mockDb.product.findUnique.mockResolvedValue(product);

      const result = await productsService.getProductById("p1");
      expect(result.id).toBe("p1");
    });

    it("should throw NotFoundError for non-existent id", async () => {
      mockDb.product.findUnique.mockResolvedValue(null);

      await expect(productsService.getProductById("bad_id")).rejects.toThrow("Product not found");
    });
  });

  // ───────────────────── createProduct ─────────────────────
  describe("createProduct", () => {
    it("should create product with artisan id", async () => {
      const data = { name: "Vase", description: "Nice vase", price: 50, categoryId: "c1", imageUrls: ["img.jpg"] };
      const created = fakeProduct({ ...data, artisanId: "a1" });
      mockDb.product.create.mockResolvedValue(created);

      const result = await productsService.createProduct(data, "a1");

      expect(mockDb.product.create).toHaveBeenCalledWith({ data: { ...data, artisanId: "a1" } });
      expect(result.artisanId).toBe("a1");
    });
  });

  // ───────────────────── updateProduct ─────────────────────
  describe("updateProduct", () => {
    it("should allow artisan to update their own product", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ id: "p1", artisanId: "a1" }));
      mockDb.product.update.mockResolvedValue(fakeProduct({ id: "p1", name: "Updated" }));

      const result = await productsService.updateProduct("p1", { name: "Updated" }, { sub: "a1", role: "ARTISAN" });

      expect(mockDb.product.update).toHaveBeenCalledWith({ where: { id: "p1" }, data: { name: "Updated" } });
    });

    it("should throw ForbiddenError when artisan tries to update another's product", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ id: "p1", artisanId: "a1" }));

      await expect(
        productsService.updateProduct("p1", { name: "X" }, { sub: "a2", role: "ARTISAN" })
      ).rejects.toThrow("You can only edit your own products");
    });

    it("should allow admin to update any product", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ id: "p1", artisanId: "a1" }));
      mockDb.product.update.mockResolvedValue(fakeProduct({ id: "p1" }));

      await productsService.updateProduct("p1", { name: "X" }, { sub: "admin1", role: "ADMIN" });

      expect(mockDb.product.update).toHaveBeenCalled();
    });

    it("should throw NotFoundError for non-existent product", async () => {
      mockDb.product.findUnique.mockResolvedValue(null);

      await expect(
        productsService.updateProduct("bad", {}, { sub: "a1", role: "ARTISAN" })
      ).rejects.toThrow("Product not found");
    });
  });

  // ───────────────────── deleteProduct ─────────────────────
  describe("deleteProduct", () => {
    it("should allow artisan to delete their own product", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ id: "p1", artisanId: "a1" }));
      mockDb.product.delete.mockResolvedValue({});

      const result = await productsService.deleteProduct("p1", { sub: "a1", role: "ARTISAN" });

      expect(result.message).toBe("Product deleted");
    });

    it("should throw ForbiddenError when artisan tries to delete another's product", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ id: "p1", artisanId: "a1" }));

      await expect(
        productsService.deleteProduct("p1", { sub: "a2", role: "ARTISAN" })
      ).rejects.toThrow("You can only delete your own products");
    });

    it("should allow admin to delete any product", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ id: "p1", artisanId: "a1" }));
      mockDb.product.delete.mockResolvedValue({});

      await productsService.deleteProduct("p1", { sub: "admin1", role: "ADMIN" });

      expect(mockDb.product.delete).toHaveBeenCalledWith({ where: { id: "p1" } });
    });

    it("should throw NotFoundError for non-existent product", async () => {
      mockDb.product.findUnique.mockResolvedValue(null);

      await expect(productsService.deleteProduct("bad", { sub: "a1", role: "ARTISAN" })).rejects.toThrow(
        "Product not found"
      );
    });
  });
});
