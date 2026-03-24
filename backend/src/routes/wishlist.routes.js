const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const wishlistController = require("../controllers/wishlist.controller");
const { productSchema } = require("../validators/wishlist.validator");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(wishlistController.get),
);

router.post(
  "/add",
  requireAuth,
  validate(productSchema),
  asyncHandler(wishlistController.add),
);

router.delete(
  "/remove",
  requireAuth,
  validate(productSchema, "query"),
  asyncHandler(wishlistController.remove),
);

module.exports = router;
