const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const contactController = require("../controllers/contact.controller");
const { contactSchema } = require("../validators/contact.validator");

const router = express.Router();

router.post("/", validate(contactSchema), asyncHandler(contactController.createContact));

module.exports = router;
