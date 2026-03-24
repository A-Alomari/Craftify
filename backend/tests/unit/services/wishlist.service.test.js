/**
 * Unit tests for wishlist.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

const wishlistService = require("../../../src/services/wishlist.service");
const { fakeWishlist } = require("../../fixtures/users");

describe("Wishlist Service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("getWishlist", () => {
    it("should return existing wishlist with items", async () => {
      const wl = fakeWishlist({ id: "wl1", userId: "u1" });
      const fullWl = { ...wl, items: [{ id: "wi1", productId: "p1", product: {} }] };

      mockDb.wishlist.findUnique
        .mockResolvedValueOnce(wl)
        .mockResolvedValueOnce(fullWl);

      const result = await wishlistService.getWishlist("u1");
      expect(result.items).toHaveLength(1);
    });

    it("should create wishlist if none exists", async () => {
      const newWl = fakeWishlist({ id: "wl_new", userId: "u2" });
      mockDb.wishlist.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...newWl, items: [] });
      mockDb.wishlist.create.mockResolvedValue(newWl);

      await wishlistService.getWishlist("u2");
      expect(mockDb.wishlist.create).toHaveBeenCalledWith({ data: { userId: "u2" } });
    });
  });

  describe("addToWishlist", () => {
    it("should upsert wishlist item", async () => {
      mockDb.wishlist.findUnique.mockResolvedValue(fakeWishlist({ id: "wl1" }));
      mockDb.wishlistItem.upsert.mockResolvedValue({ id: "wi1" });

      await wishlistService.addToWishlist("u1", "p1");

      expect(mockDb.wishlistItem.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { wishlistId_productId: { wishlistId: "wl1", productId: "p1" } },
        })
      );
    });
  });

  describe("removeFromWishlist", () => {
    it("should delete wishlist item", async () => {
      mockDb.wishlist.findUnique.mockResolvedValue(fakeWishlist({ id: "wl1" }));
      mockDb.wishlistItem.delete.mockResolvedValue({});

      await wishlistService.removeFromWishlist("u1", "p1");

      expect(mockDb.wishlistItem.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { wishlistId_productId: { wishlistId: "wl1", productId: "p1" } },
        })
      );
    });
  });
});
