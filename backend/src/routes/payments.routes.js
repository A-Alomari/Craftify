const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const paymentsController = require("../controllers/payments.controller");

const router = express.Router();

router.post(
  "/webhook",
  asyncHandler(paymentsController.webhook),
);

module.exports = router;
