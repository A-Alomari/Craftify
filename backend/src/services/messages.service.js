const { db } = require("../models");
const { ForbiddenError } = require("../utils/http");
const { emitConversationMessage, emitUserNotification } = require("./realtime.service");

/**
 * Handles the listConversations operation.
 * @param {unknown} userId
 * @returns {Promise<unknown>}
 */
async function listConversations(userId) {
  return db.conversation.findMany({
    where: {
      participants: {
        some: { userId },
      },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Handles the listConversationMessages operation.
 * @param {unknown} conversationId
 * @param {unknown} userId
 * @returns {Promise<unknown>}
 */
async function listConversationMessages(conversationId, userId) {
  const belongs = await db.conversationParticipant.findFirst({
    where: {
      conversationId,
      userId,
    },
  });

  if (!belongs) {
    throw new ForbiddenError("Not part of this conversation");
  }

  return db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Handles the sendMessage operation.
 * @param {unknown} payload
 * @param {unknown} senderId
 * @returns {Promise<unknown>}
 */
async function sendMessage(payload, senderId) {
  const message = await db.message.create({
    data: {
      conversationId: payload.conversationId,
      senderId,
      receiverId: payload.receiverId,
      content: payload.content,
    },
  });

  await db.conversation.update({
    where: { id: payload.conversationId },
    data: { updatedAt: new Date() },
  });

  emitConversationMessage({
    conversationId: payload.conversationId,
    message,
  });

  emitUserNotification({
    userId: payload.receiverId,
    notification: {
      type: "message",
      message: "You received a new message",
    },
  });

  return message;
}

module.exports = {
  listConversations,
  listConversationMessages,
  sendMessage,
};
