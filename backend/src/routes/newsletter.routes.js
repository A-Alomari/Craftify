const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const newsletterController = require("../controllers/newsletter.controller");
const { newsletterSchema } = require("../validators/newsletter.validator");

const router = express.Router();

router.post(
  "/subscribe",
  validate(newsletterSchema),
  asyncHandler(newsletterController.subscribe),
);

module.exports = router;
