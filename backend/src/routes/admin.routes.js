const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const adminController = require("../controllers/admin.controller");
const { updateUserSchema } = require("../validators/admin.validator");

const router = express.Router();

router.use(requireAuth, requireRole(["ADMIN"]));

router.get(
  "/dashboard",
  asyncHandler(adminController.dashboard),
);

router.get(
  "/users",
  asyncHandler(adminController.users),
);

router.get(
  "/orders",
  asyncHandler(adminController.orders),
);

router.put(
  "/users/:id",
  validate(updateUserSchema),
  asyncHandler(adminController.updateUser),
);

module.exports = router;
