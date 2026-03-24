const staticService = require("../services/static.service");

/**
 * Handles the createContact operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function createContact(req, res) {
  const item = await staticService.createContactMessage(req.body);
  res.status(201).json({ success: true, item });
}

module.exports = {
  createContact,
};
