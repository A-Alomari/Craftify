const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const ordersController = require("../controllers/orders.controller");
const { checkoutSchema, statusSchema } = require("../validators/order.validator");

const router = express.Router();

router.post(
  "/",
  requireAuth,
  validate(checkoutSchema),
  asyncHandler(ordersController.checkout),
);

router.get(
  "/",
  requireAuth,
  asyncHandler(ordersController.list),
);

router.get(
  "/:id",
  requireAuth,
  asyncHandler(ordersController.getById),
);

router.put(
  "/:id/status",
  requireAuth,
  requireRole(["ARTISAN", "ADMIN"]),
  validate(statusSchema),
  asyncHandler(ordersController.updateStatus),
);

router.post(
  "/:id/confirm",
  requireAuth,
  asyncHandler(ordersController.confirm),
);

module.exports = router;
