const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const staticController = require("../controllers/static.controller");
const { contactSchema } = require("../validators/contact.validator");

const router = express.Router();

router.get(
  "/",
  asyncHandler(staticController.listFaqs),
);

router.post(
  "/",
  validate(contactSchema),
  asyncHandler(staticController.createContact),
);

module.exports = router;
