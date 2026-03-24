const { parseWebhook } = require("../services/payments");

/**
 * Handles the webhook operation.
 * @param {unknown} req
 * @param {unknown} res
 * @returns {Promise<void>}
 */
async function webhook(req, res) {
  const signature = req.headers["stripe-signature"];
  const parsed = await parseWebhook(req.body, signature);

  res.json({
    success: true,
    received: true,
    provider: parsed.provider,
    validated: parsed.validated,
    eventType: parsed.event && parsed.event.type ? parsed.event.type : "unknown",
  });
}

module.exports = {
  webhook,
};
