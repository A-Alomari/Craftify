/**
 * Unit tests for auctions.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

jest.mock("../../../src/services/payments", () => ({
  createPayment: jest.fn(() => Promise.resolve({ status: "succeeded", provider: "mock", paymentId: "mock_123" })),
}));

jest.mock("../../../src/services/realtime.service", () => ({
  emitAuctionBid: jest.fn(),
}));

const auctionsService = require("../../../src/services/auctions.service");
const { createPayment } = require("../../../src/services/payments");
const { emitAuctionBid } = require("../../../src/services/realtime.service");
const { fakeAuction, fakeProduct, fakeBid } = require("../../fixtures/users");

describe("Auctions Service", () => {
  beforeEach(() => jest.clearAllMocks());

  // ───────────────────── listLiveAuctions ─────────────────────
  describe("listLiveAuctions", () => {
    it("should return list of live auctions", async () => {
      const auctions = [fakeAuction(), fakeAuction()];
      mockDb.auction.findMany.mockResolvedValue(auctions);

      const result = await auctionsService.listLiveAuctions();

      expect(result).toHaveLength(2);
      expect(mockDb.auction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: "LIVE" } })
      );
    });
  });

  // ───────────────────── getAuctionById ─────────────────────
  describe("getAuctionById", () => {
    it("should return auction with bids for valid id", async () => {
      const auction = fakeAuction({ id: "auc1" });
      mockDb.auction.findUnique.mockResolvedValue(auction);

      const result = await auctionsService.getAuctionById("auc1");
      expect(result.id).toBe("auc1");
    });

    it("should throw NotFoundError for non-existent id", async () => {
      mockDb.auction.findUnique.mockResolvedValue(null);

      await expect(auctionsService.getAuctionById("bad")).rejects.toThrow("Auction not found");
    });
  });

  // ───────────────────── createAuction ─────────────────────
  describe("createAuction", () => {
    it("should create auction for own product", async () => {
      const product = fakeProduct({ id: "p1", artisanId: "a1" });
      const startAt = new Date(Date.now() + 3600000).toISOString();
      const endAt = new Date(Date.now() + 7200000).toISOString();
      const payload = { productId: "p1", startingBid: 10, bidIncrement: 1, startAt, endAt };

      mockDb.product.findUnique.mockResolvedValue(product);
      mockDb.auction.create.mockResolvedValue(fakeAuction({ productId: "p1" }));

      const result = await auctionsService.createAuction(payload, { sub: "a1", role: "ARTISAN" });

      expect(mockDb.auction.create).toHaveBeenCalled();
    });

    it("should throw NotFoundError if product does not exist", async () => {
      mockDb.product.findUnique.mockResolvedValue(null);

      await expect(
        auctionsService.createAuction({ productId: "bad" }, { sub: "a1", role: "ARTISAN" })
      ).rejects.toThrow("Product not found");
    });

    it("should throw ForbiddenError if artisan creates auction for another's product", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ artisanId: "a1" }));

      await expect(
        auctionsService.createAuction({ productId: "p1" }, { sub: "a2", role: "ARTISAN" })
      ).rejects.toThrow("You can only create auctions for your own products");
    });
  });

  // ───────────────────── placeBid ─────────────────────
  describe("placeBid", () => {
    it("should place a valid bid and emit event", async () => {
      const auction = fakeAuction({ id: "auc1", currentBid: 10, bidIncrement: 1, status: "LIVE" });
      const bid = fakeBid({ id: "bid1", amount: 11.5 });

      mockDb.auction.findUnique.mockResolvedValue(auction);
      mockDb.bid.create.mockResolvedValue(bid);
      mockDb.auction.update.mockResolvedValue({ ...auction, currentBid: 11.5, winnerId: "u1" });

      const result = await auctionsService.placeBid("auc1", 11.5, "u1");

      expect(mockDb.bid.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ amount: 11.5, userId: "u1" }) })
      );
      expect(emitAuctionBid).toHaveBeenCalledWith(
        expect.objectContaining({ auctionId: "auc1" })
      );
    });

    it("should throw NotFoundError for non-existent auction", async () => {
      mockDb.auction.findUnique.mockResolvedValue(null);

      await expect(auctionsService.placeBid("bad", 15, "u1")).rejects.toThrow("Auction not found");
    });

    it("should throw ValidationError if auction is not live", async () => {
      mockDb.auction.findUnique.mockResolvedValue(fakeAuction({ status: "ENDED" }));

      await expect(auctionsService.placeBid("auc1", 15, "u1")).rejects.toThrow("Auction is not live");
    });

    it("should throw ValidationError if bid is below minimum", async () => {
      const auction = fakeAuction({ currentBid: 10, bidIncrement: 5, status: "LIVE" });
      mockDb.auction.findUnique.mockResolvedValue(auction);

      await expect(auctionsService.placeBid("auc1", 12, "u1")).rejects.toThrow("Bid must be at least");
    });

    it("should throw ValidationError if bidding window has closed", async () => {
      const auction = fakeAuction({
        status: "LIVE",
        startAt: new Date(Date.now() - 7200000),
        endAt: new Date(Date.now() - 3600000), // ended 1 hour ago
      });
      mockDb.auction.findUnique.mockResolvedValue(auction);

      await expect(auctionsService.placeBid("auc1", 15, "u1")).rejects.toThrow("Bidding is closed");
    });
  });

  // ───────────────────── payForAuction ─────────────────────
  describe("payForAuction", () => {
    it("should process payment for winning bidder", async () => {
      const auction = fakeAuction({
        id: "auc1",
        winnerId: "u1",
        currentBid: 50,
        status: "ENDED",
        endAt: new Date(Date.now() - 1000),
        product: fakeProduct(),
      });

      mockDb.auction.findUnique.mockResolvedValue(auction);
      const mockOrder = { id: "ord1", items: [] };
      mockDb.transaction.mockImplementation(async (cb) => {
        const tx = {
          order: { create: jest.fn().mockResolvedValue(mockOrder) },
          auction: { update: jest.fn().mockResolvedValue(auction) },
        };
        return cb(tx);
      });

      const result = await auctionsService.payForAuction("auc1", "u1", {
        shippingName: "A",
        shippingEmail: "a@b.com",
        shippingStreet: "123 St",
        shippingCity: "City",
        shippingState: "ST",
        shippingZip: "12345",
      });

      expect(createPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 50 }));
      expect(result.order).toBeDefined();
    });

    it("should throw ForbiddenError if not the winner", async () => {
      mockDb.auction.findUnique.mockResolvedValue(fakeAuction({ winnerId: "u2" }));

      await expect(auctionsService.payForAuction("auc1", "u1", {})).rejects.toThrow(
        "Only the winning bidder can pay"
      );
    });

    it("should throw NotFoundError for non-existent auction", async () => {
      mockDb.auction.findUnique.mockResolvedValue(null);

      await expect(auctionsService.payForAuction("bad", "u1", {})).rejects.toThrow("Auction not found");
    });
  });
});
