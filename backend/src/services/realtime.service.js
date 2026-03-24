const { getIo } = require("../config/socket");

/**
 * Publish a new bid event for an auction room.
 * @param {{ auctionId: string, currentBid: number, bid: object }} payload
 * @returns {void}
 */
function emitAuctionBid(payload) {
  const io = getIo();
  if (!io) {
    return;
  }

  io.to(`auction:${payload.auctionId}`).emit("auction:new_bid", payload);
}

/**
 * Publish a new message event to a conversation room.
 * @param {{ conversationId: string, message: object }} payload
 * @returns {void}
 */
function emitConversationMessage(payload) {
  const io = getIo();
  if (!io) {
    return;
  }

  io.to(`conversation:${payload.conversationId}`).emit("chat:new_message", payload.message);
}

/**
 * Publish a user-specific notification event.
 * @param {{ userId: string, notification: object }} payload
 * @returns {void}
 */
function emitUserNotification(payload) {
  const io = getIo();
  if (!io) {
    return;
  }

  io.to(`user:${payload.userId}`).emit("notification:new", payload.notification);
}

module.exports = {
  emitAuctionBid,
  emitConversationMessage,
  emitUserNotification,
};