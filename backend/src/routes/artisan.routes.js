const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const artisanController = require("../controllers/artisan.controller");
const { artisanRegistrationSchema } = require("../validators/artisan.validator");

const router = express.Router();

router.get(
  "/:id",
  asyncHandler(artisanController.getById),
);

router.post(
  "/register",
  requireAuth,
  validate(artisanRegistrationSchema),
  asyncHandler(artisanController.register),
);

router.get(
  "/dashboard",
  requireAuth,
  requireRole(["ARTISAN", "ADMIN"]),
  asyncHandler(artisanController.dashboard),
);

router.get(
  "/orders",
  requireAuth,
  requireRole(["ARTISAN", "ADMIN"]),
  asyncHandler(artisanController.orders),
);

router.get(
  "/analytics",
  requireAuth,
  requireRole(["ARTISAN", "ADMIN"]),
  asyncHandler(artisanController.analytics),
);

module.exports = router;
