/**
 * Unit tests for search.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

const searchService = require("../../../src/services/search.service");
const { fakeProduct, fakeUser } = require("../../fixtures/users");

describe("Search Service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("search", () => {
    it("should return products and artisans matching query", async () => {
      mockDb.product.findMany.mockResolvedValue([fakeProduct({ name: "Handmade Mug" })]);
      mockDb.user.findMany.mockResolvedValue([{ id: "a1", fullName: "Clay Artisan", avatarUrl: null }]);

      const result = await searchService.search("handmade");

      expect(result.products).toHaveLength(1);
      expect(result.artisans).toHaveLength(1);
    });

    it("should return empty arrays for empty query", async () => {
      const result = await searchService.search("");

      expect(result.products).toEqual([]);
      expect(result.artisans).toEqual([]);
      expect(mockDb.product.findMany).not.toHaveBeenCalled();
    });

    it("should return empty arrays for whitespace-only query", async () => {
      const result = await searchService.search("   ");

      expect(result.products).toEqual([]);
      expect(result.artisans).toEqual([]);
    });

    it("should return empty arrays when no results found", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.user.findMany.mockResolvedValue([]);

      const result = await searchService.search("xyznonexistent");

      expect(result.products).toHaveLength(0);
      expect(result.artisans).toHaveLength(0);
    });

    it("should search products with case-insensitive mode", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.user.findMany.mockResolvedValue([]);

      await searchService.search("Handmade");

      const productWhere = mockDb.product.findMany.mock.calls[0][0].where;
      expect(productWhere.OR[0].name.mode).toBe("insensitive");
    });

    it("should only search ACTIVE products", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.user.findMany.mockResolvedValue([]);

      await searchService.search("test");

      const where = mockDb.product.findMany.mock.calls[0][0].where;
      expect(where.status).toBe("ACTIVE");
    });

    it("should only search ARTISAN role users", async () => {
      mockDb.product.findMany.mockResolvedValue([]);
      mockDb.user.findMany.mockResolvedValue([]);

      await searchService.search("test");

      const where = mockDb.user.findMany.mock.calls[0][0].where;
      expect(where.role).toBe("ARTISAN");
    });
  });
});
