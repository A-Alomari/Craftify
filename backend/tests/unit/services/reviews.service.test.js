/**
 * Unit tests for reviews.service.js
 */
const mockDb = require("../../helpers/setup").createMockDb();
jest.mock("../../../src/models", () => ({ db: mockDb }));

const reviewsService = require("../../../src/services/reviews.service");
const { fakeReview } = require("../../fixtures/users");

describe("Reviews Service", () => {
  beforeEach(() => jest.clearAllMocks());

  describe("upsertReview", () => {
    it("should create or update a review", async () => {
      const review = fakeReview({ userId: "u1", productId: "p1", rating: 5, body: "Amazing craft!" });
      mockDb.review.upsert.mockResolvedValue(review);

      const result = await reviewsService.upsertReview("u1", {
        productId: "p1",
        rating: 5,
        title: "Great",
        body: "Amazing craft!",
      });

      expect(mockDb.review.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_productId: { userId: "u1", productId: "p1" } },
          create: expect.objectContaining({ rating: 5 }),
          update: expect.objectContaining({ rating: 5 }),
        })
      );
      expect(result.rating).toBe(5);
    });
  });

  describe("listProductReviews", () => {
    it("should return reviews for a product", async () => {
      const reviews = [fakeReview(), fakeReview()];
      mockDb.review.findMany.mockResolvedValue(reviews);

      const result = await reviewsService.listProductReviews("p1");

      expect(result).toHaveLength(2);
      expect(mockDb.review.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { productId: "p1" } })
      );
    });

    it("should return empty array when no reviews exist", async () => {
      mockDb.review.findMany.mockResolvedValue([]);

      const result = await reviewsService.listProductReviews("p_no_reviews");
      expect(result).toHaveLength(0);
    });
  });
});
