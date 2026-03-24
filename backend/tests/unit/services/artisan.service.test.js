/**
 * Unit tests for artisan.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

const artisanService = require("../../../src/services/artisan.service");
const { fakeUser, fakeArtisanProfile, fakeProduct } = require("../../fixtures/users");

describe("Artisan Service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("getArtisanById", () => {
    it("should return artisan with products", async () => {
      const artisan = {
        id: "a1",
        fullName: "Artisan Joe",
        avatarUrl: null,
        bio: "Craftsman",
        artisanProfile: fakeArtisanProfile({ userId: "a1" }),
        products: [fakeProduct()],
      };
      mockDb.user.findFirst.mockResolvedValue(artisan);

      const result = await artisanService.getArtisanById("a1");
      expect(result.fullName).toBe("Artisan Joe");
      expect(result.products).toHaveLength(1);
    });

    it("should throw NotFoundError for non-existent artisan", async () => {
      mockDb.user.findFirst.mockResolvedValue(null);

      await expect(artisanService.getArtisanById("bad")).rejects.toThrow("Artisan not found");
    });
  });

  describe("registerArtisan", () => {
    it("should upgrade user to artisan and create profile", async () => {
      const user = fakeUser({ id: "u1", role: "ARTISAN" });
      const profile = fakeArtisanProfile({ userId: "u1", shopName: "My Shop" });

      mockDb.user.update.mockResolvedValue(user);
      mockDb.artisanProfile.upsert.mockResolvedValue(profile);

      const result = await artisanService.registerArtisan("u1", { shopName: "My Shop", location: "NY" });

      expect(mockDb.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "u1" }, data: { role: "ARTISAN" } })
      );
      expect(result.profile.shopName).toBe("My Shop");
    });
  });

  describe("getDashboardStats", () => {
    it("should return artisan-specific stats", async () => {
      mockDb.product.count.mockResolvedValue(5);
      mockDb.auction.count.mockResolvedValue(2);
      mockDb.orderItem.count.mockResolvedValue(15);

      const result = await artisanService.getDashboardStats("a1");

      expect(result).toEqual({ productCount: 5, liveAuctionCount: 2, ordersCount: 15 });
    });
  });

  describe("getArtisanOrders", () => {
    it("should return orders containing artisan's products", async () => {
      mockDb.orderItem.findMany.mockResolvedValue([{ id: "oi1" }]);

      const result = await artisanService.getArtisanOrders("a1");
      expect(result).toHaveLength(1);
    });
  });

  describe("getAnalytics", () => {
    it("should calculate gross sales and units sold", async () => {
      mockDb.orderItem.findMany.mockResolvedValue([
        { unitPrice: 10, quantity: 3, order: {}, product: {} },
        { unitPrice: 25, quantity: 2, order: {}, product: {} },
      ]);

      const result = await artisanService.getAnalytics("a1");

      expect(result.grossSales).toBe(80); // (10*3)+(25*2)
      expect(result.unitsSold).toBe(5);
    });

    it("should return zeros when no sales", async () => {
      mockDb.orderItem.findMany.mockResolvedValue([]);

      const result = await artisanService.getAnalytics("a1");

      expect(result.grossSales).toBe(0);
      expect(result.unitsSold).toBe(0);
    });
  });
});
