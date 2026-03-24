/**
 * Integration tests for Auctions endpoints
 */
const { request, app, mockDb, authHeader } = require("./setup");
const { fakeAuction, fakeProduct, fakeBid } = require("../fixtures/users");

describe("Auctions API Endpoints", () => {
  beforeEach(() => jest.clearAllMocks());

  // ───── GET /api/auctions ─────
  describe("GET /api/auctions", () => {
    it("should return 200 + list of live auctions", async () => {
      mockDb.auction.findMany.mockResolvedValue([fakeAuction()]);

      const res = await request(app).get("/api/auctions");

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
    });
  });

  // ───── GET /api/auctions/:id ─────
  describe("GET /api/auctions/:id", () => {
    it("should return 200 + auction detail with bids", async () => {
      mockDb.auction.findUnique.mockResolvedValue(fakeAuction({ id: "auc1" }));

      const res = await request(app).get("/api/auctions/auc1");

      expect(res.status).toBe(200);
      expect(res.body.auction).toBeDefined();
    });

    it("should return 404 for non-existent auction", async () => {
      mockDb.auction.findUnique.mockResolvedValue(null);

      const res = await request(app).get("/api/auctions/bad");

      expect(res.status).toBe(404);
    });
  });

  // ───── POST /api/auctions ─────
  describe("POST /api/auctions", () => {
    const validAuction = {
      productId: "p1",
      startingBid: 10,
      bidIncrement: 1,
      startAt: new Date(Date.now() + 3600000).toISOString(),
      endAt: new Date(Date.now() + 7200000).toISOString(),
    };

    it("should create auction as artisan → 201", async () => {
      mockDb.product.findUnique.mockResolvedValue(fakeProduct({ artisanId: "artisan_001" }));
      mockDb.auction.create.mockResolvedValue(fakeAuction());

      const res = await request(app)
        .post("/api/auctions")
        .set("Authorization", authHeader("artisan"))
        .send(validAuction);

      expect(res.status).toBe(201);
    });

    it("should return 403 when buyer tries to create", async () => {
      const res = await request(app)
        .post("/api/auctions")
        .set("Authorization", authHeader("buyer"))
        .send(validAuction);

      expect(res.status).toBe(403);
    });

    it("should return 401 when unauthenticated", async () => {
      const res = await request(app).post("/api/auctions").send(validAuction);

      expect(res.status).toBe(401);
    });
  });

  // ───── POST /api/auctions/:id/bid ─────
  describe("POST /api/auctions/:id/bid", () => {
    it("should place a valid bid → 201", async () => {
      const auction = fakeAuction({ id: "auc1", currentBid: 10, bidIncrement: 1, status: "LIVE" });
      mockDb.auction.findUnique.mockResolvedValue(auction);
      mockDb.bid.create.mockResolvedValue(fakeBid({ amount: 11.5 }));
      mockDb.auction.update.mockResolvedValue({ ...auction, currentBid: 11.5 });

      const res = await request(app)
        .post("/api/auctions/auc1/bid")
        .set("Authorization", authHeader("buyer"))
        .send({ amount: 11.5 });

      expect(res.status).toBe(201);
    });

    it("should return 401 when unauthenticated", async () => {
      const res = await request(app)
        .post("/api/auctions/auc1/bid")
        .send({ amount: 15 });

      expect(res.status).toBe(401);
    });
  });
});
