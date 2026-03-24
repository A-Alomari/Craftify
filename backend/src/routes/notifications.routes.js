const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { requireAuth } = require("../middleware/auth");
const notificationsController = require("../controllers/notifications.controller");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(notificationsController.list),
);

router.put(
  "/:id/read",
  requireAuth,
  asyncHandler(notificationsController.markRead),
);

module.exports = router;
