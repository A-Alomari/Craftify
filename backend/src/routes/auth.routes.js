const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
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
  authLimiter,
  validate(registerSchema),
  asyncHandler(authController.register),
);

router.post(
  "/login",
  authLimiter,
  validate(loginSchema),
  asyncHandler(authController.login),
);

router.post(
  "/refresh",
  asyncHandler(authController.refresh),
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(authController.me),
);

router.post(
  "/forgot-password",
  authLimiter,
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

router.post(
  "/logout",
  asyncHandler(authController.logout),
);

module.exports = router;
