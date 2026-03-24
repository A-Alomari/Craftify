const messagesService = require("../services/messages.service");

/**
 * Handles the list operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function list(req, res) {
  const items = await messagesService.listConversations(req.auth.sub);
  res.json({ success: true, items });
}

/**
 * Handles the listByConversation operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function listByConversation(req, res) {
  const items = await messagesService.listConversationMessages(req.params.conversationId, req.auth.sub);
  res.json({ success: true, items });
}

/**
 * Handles the send operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function send(req, res) {
  const message = await messagesService.sendMessage(req.body, req.auth.sub);
  res.status(201).json({ success: true, message });
}

module.exports = {
  list,
  listByConversation,
  send,
};
