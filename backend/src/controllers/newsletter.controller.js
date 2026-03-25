const newsletterService = require("../services/newsletter.service");

/**
 * Subscribe an email address to the newsletter list.
 * @param {import("express").Request} req
 * @param {import("express").Response} res
 * @returns {Promise<void>}
 */
async function subscribe(req, res) {
  const item = await newsletterService.subscribe(req.body);
  res.status(201).json({
    success: true,
    item,
    message: "Subscribed successfully",
  });
}

module.exports = {
  subscribe,
};
