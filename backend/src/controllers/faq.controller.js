const staticService = require("../services/static.service");

/**
 * Handles the listFaqs operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function listFaqs(req, res) {
  const items = await staticService.listFaqs();
  res.json({ success: true, items });
}

module.exports = {
  listFaqs,
};
