const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const usersController = require("../controllers/users.controller");
const { profileSchema } = require("../validators/user.validator");

const router = express.Router();

router.get(
  "/me",
  requireAuth,
  asyncHandler(usersController.me),
);

router.put(
  "/me",
  requireAuth,
  validate(profileSchema),
  asyncHandler(usersController.updateMe),
);

module.exports = router;
