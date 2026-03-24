const searchService = require("../services/search.service");

/**
 * Handles the search operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function search(req, res) {
  const result = await searchService.search(req.query.q);
  res.json({ success: true, ...result });
}

module.exports = {
  search,
};
