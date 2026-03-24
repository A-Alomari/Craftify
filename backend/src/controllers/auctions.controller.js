const auctionsService = require("../services/auctions.service");

/**
 * Handles the list operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function list(req, res) {
  const items = await auctionsService.listLiveAuctions();
  res.json({ success: true, items });
}

/**
 * Handles the getById operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function getById(req, res) {
  const auction = await auctionsService.getAuctionById(req.params.id);
  res.json({ success: true, auction });
}

/**
 * Handles the create operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function create(req, res) {
  const auction = await auctionsService.createAuction(req.body, req.auth);
  res.status(201).json({ success: true, auction });
}

/**
 * Handles the bid operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function bid(req, res) {
  const result = await auctionsService.placeBid(req.params.id, req.body.amount, req.auth.sub);
  res.status(201).json({ success: true, bid: result.bid, auction: result.auction });
}

/**
 * Handles the pay operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function pay(req, res) {
  const result = await auctionsService.payForAuction(req.params.id, req.auth.sub, req.body);
  res.status(201).json({ success: true, ...result });
}

module.exports = {
  list,
  getById,
  create,
  bid,
  pay,
};
