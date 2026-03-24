const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const authController = require("../controllers/auth.controller");
const {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  verifyCodeSchema,
  resetPasswordSchema,
} = require("../validators/auth.validator");

const router = express.Router();

router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(authController.register),
);

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(authController.login),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(authController.me),
);

router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);

router.post(
  "/verify-code",
  validate(verifyCodeSchema),
  asyncHandler(authController.verifyCode),
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword),
);

module.exports = router;
