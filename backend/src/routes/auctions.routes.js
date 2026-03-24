const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const auctionsController = require("../controllers/auctions.controller");
const { auctionSchema, bidSchema, auctionPaymentSchema } = require("../validators/auction.validator");

const router = express.Router();

router.get(
  "/",
  asyncHandler(auctionsController.list),
);

router.get(
  "/:id",
  asyncHandler(auctionsController.getById),
);

router.post(
  "/",
  requireAuth,
  requireRole(["ARTISAN", "ADMIN"]),
  validate(auctionSchema),
  asyncHandler(auctionsController.create),
);

router.post(
  "/:id/bid",
  requireAuth,
  requireRole(["BUYER", "ARTISAN", "ADMIN"]),
  validate(bidSchema),
  asyncHandler(auctionsController.bid),
);

router.post(
  "/:id/pay",
  requireAuth,
  validate(auctionPaymentSchema),
  asyncHandler(auctionsController.pay),
);

module.exports = router;
