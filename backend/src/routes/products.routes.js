const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const productsController = require("../controllers/products.controller");
const { productSchema } = require("../validators/product.validator");

const router = express.Router();

router.get(
  "/",
  asyncHandler(productsController.list),
);

router.get(
  "/:id",
  asyncHandler(productsController.getById),
);

router.post(
  "/",
  requireAuth,
  requireRole(["ARTISAN", "ADMIN"]),
  validate(productSchema),
  asyncHandler(productsController.create),
);

router.post(
  "/upload",
  requireAuth,
  requireRole(["ARTISAN", "ADMIN"]),
  upload.single("image"),
  asyncHandler(productsController.uploadImage),
);

router.put(
  "/:id",
  requireAuth,
  requireRole(["ARTISAN", "ADMIN"]),
  validate(productSchema.partial()),
  asyncHandler(productsController.update),
);

router.delete(
  "/:id",
  requireAuth,
  requireRole(["ARTISAN", "ADMIN"]),
  asyncHandler(productsController.remove),
);

module.exports = router;
