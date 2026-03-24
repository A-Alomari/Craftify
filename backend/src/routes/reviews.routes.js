const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const reviewsController = require("../controllers/reviews.controller");
const { reviewSchema } = require("../validators/review.validator");

const router = express.Router();

router.post(
  "/",
  requireAuth,
  validate(reviewSchema),
  asyncHandler(reviewsController.upsert),
);

router.get(
  "/:productId",
  asyncHandler(reviewsController.listByProduct),
);

module.exports = router;
