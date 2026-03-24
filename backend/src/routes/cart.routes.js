const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const cartController = require("../controllers/cart.controller");
const { addSchema, updateSchema, removeSchema } = require("../validators/cart.validator");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(cartController.getCart),
);

router.post(
  "/add",
  requireAuth,
  validate(addSchema),
  asyncHandler(cartController.add),
);

router.put(
  "/update",
  requireAuth,
  validate(updateSchema),
  asyncHandler(cartController.update),
);

router.delete(
  "/remove",
  requireAuth,
  validate(removeSchema, "query"),
  asyncHandler(cartController.remove),
);

module.exports = router;
