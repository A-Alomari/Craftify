const { env } = require("../config/env");
const { ValidationError } = require("../utils/http");

let stripeClient = null;

if (env.paymentProvider === "stripe" && env.stripeSecretKey) {
  try {
    // Lazy optional dependency: falls back to mock if stripe is unavailable.
    // eslint-disable-next-line global-require
    const Stripe = require("stripe");
    stripeClient = new Stripe(env.stripeSecretKey);
  } catch (_error) {
    stripeClient = null;
  }
}

function toMinorUnits(amount) {
  return Math.round(Number(amount || 0) * 100);
}

/**
 * Handles the createPayment operation.
 * @param {unknown} options
 * @returns {Promise<unknown>}
 */
async function createPayment(options) {
  const amount = Number(options.amount || 0);
  if (amount <= 0) {
    throw new ValidationError("Invalid payment amount");
  }

  if (stripeClient) {
    const intent = await stripeClient.paymentIntents.create({
      amount: toMinorUnits(amount),
      currency: options.currency || "usd",
      payment_method: options.paymentMethodToken || "pm_card_visa",
      payment_method_types: ["card"],
      confirm: true,
      description: options.description || "Craftify payment",
      metadata: options.metadata || {},
    });

    return {
      provider: "stripe",
      status: intent.status,
      paymentId: intent.id,
      amount,
      currency: intent.currency,
      raw: intent,
    };
  }

  return {
    provider: "mock",
    status: "succeeded",
    paymentId: "mock_" + Date.now(),
    amount,
    currency: options.currency || "usd",
    raw: { mocked: true },
  };
}

/**
 * Handles the parseWebhook operation.
 * @param {unknown} payload
 * @param {unknown} signature
 * @returns {Promise<unknown>}
 */
async function parseWebhook(payload, signature) {
  if (stripeClient && env.stripeWebhookSecret && signature) {
    try {
      const event = stripeClient.webhooks.constructEvent(
        Buffer.from(JSON.stringify(payload)),
        signature,
        env.stripeWebhookSecret,
      );
      return { provider: "stripe", validated: true, event };
    } catch (_error) {
      return { provider: "stripe", validated: false, event: payload };
    }
  }

  return { provider: stripeClient ? "stripe" : "mock", validated: false, event: payload };
}

module.exports = { createPayment, parseWebhook };
