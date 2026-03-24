const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const faqController = require("../controllers/faq.controller");

const router = express.Router();

router.get("/", asyncHandler(faqController.listFaqs));

module.exports = router;
