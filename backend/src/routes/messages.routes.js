const express = require("express");
const { asyncHandler } = require("../utils/asyncHandler");
const { validate } = require("../middleware/validate");
const { requireAuth } = require("../middleware/auth");
const messagesController = require("../controllers/messages.controller");
const { sendSchema } = require("../validators/message.validator");

const router = express.Router();

router.get(
  "/",
  requireAuth,
  asyncHandler(messagesController.list),
);

router.get(
  "/:conversationId",
  requireAuth,
  asyncHandler(messagesController.listByConversation),
);

router.post(
  "/send",
  requireAuth,
  validate(sendSchema),
  asyncHandler(messagesController.send),
);

module.exports = router;
