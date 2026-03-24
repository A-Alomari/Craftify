/**
 * Phase 9: Database Stress Tests
 * Tests that services handle high volume and concurrent requests gracefully.
 * Uses mocked DB layer to test service-level concurrency handling.
 */
const mockDb = require("../helpers/setup").createMockDb();
jest.mock("../../src/models", () => ({ db: mockDb }));
jest.mock("../../src/services/realtime.service", () => ({
  emitAuctionBid: jest.fn(),
  emitConversationMessage: jest.fn(),
  emitUserNotification: jest.fn(),
}));
jest.mock("../../src/services/email.service", () => ({
  sendEmail: jest.fn(() => Promise.resolve()),
}));
jest.mock("../../src/config/env", () => ({
  env: {
    jwtAccessSecret: "test_secret",
    jwtRefreshSecret: "test_refresh",
    accessTokenTtl: "15m",
    refreshTokenTtl: "7d",
    paymentProvider: "mock",
  },
}));

const searchService = require("../../src/services/search.service");
const productsService = require("../../src/services/products.service");
const { fakeProduct } = require("../fixtures/users");

describe("Phase 9: Database Stress Tests", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("Concurrent product listing", () => {
    it("should handle 50 concurrent product list calls", async () => {
      const products = Array.from({ length: 20 }, (_, i) => fakeProduct({ id: `p${i}` }));
      mockDb.product.findMany.mockResolvedValue(products);
      mockDb.product.count.mockResolvedValue(20);

      const promises = Array.from({ length: 50 }, () =>
        productsService.listProducts({ page: 1, pageSize: 20 })
      );

      const results = await Promise.all(promises);
      results.forEach((result) => {
        expect(result.items).toHaveLength(20);
        expect(result.total).toBe(20);
      });

      expect(mockDb.product.findMany).toHaveBeenCalledTimes(50);
    });
  });

  describe("Concurrent search", () => {
    it("should handle 30 concurrent search queries", async () => {
      mockDb.product.findMany.mockResolvedValue([fakeProduct()]);
      mockDb.user.findMany.mockResolvedValue([]);

      const queries = ["ceramic", "wood", "handmade", "vase", "jewelry"];
      const promises = [];

      for (let i = 0; i < 30; i++) {
        const q = queries[i % queries.length];
        promises.push(searchService.search({ q }));
      }

      const results = await Promise.all(promises);
      results.forEach((result) => {
        expect(result.products).toBeDefined();
        expect(result.artisans).toBeDefined();
      });
    });
  });

  describe("Service with slow database response", () => {
    it("should handle slow DB query without timeout", async () => {
      // Simulate 500ms delay
      mockDb.product.findMany.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve([fakeProduct()]), 500))
      );
      mockDb.product.count.mockResolvedValue(1);

      const result = await productsService.listProducts({ page: 1, pageSize: 10 });
      expect(result.items).toHaveLength(1);
    }, 10000);
  });

  describe("Service with many results", () => {
    it("should handle large result set (1000 products)", async () => {
      const manyProducts = Array.from({ length: 1000 }, (_, i) => fakeProduct({ id: `p${i}` }));
      mockDb.product.findMany.mockResolvedValue(manyProducts);
      mockDb.product.count.mockResolvedValue(1000);

      const result = await productsService.listProducts({ page: 1, pageSize: 1000 });
      expect(result.items).toHaveLength(1000);
      expect(result.total).toBe(1000);
    });
  });
});
