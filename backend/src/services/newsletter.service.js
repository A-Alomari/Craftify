const { db } = require("../models");

/**
 * Save or return an existing newsletter subscription by email.
 * @param {{email: string}} payload
 * @returns {Promise<{id: string, email: string, createdAt: Date}>}
 */
async function subscribe(payload) {
  const email = String(payload.email || "").trim().toLowerCase();

  const existing = await db.newsletterSubscription.findUnique({
    where: { email },
  });

  if (existing) {
    return existing;
  }

  return db.newsletterSubscription.create({
    data: { email },
  });
}

module.exports = {
  subscribe,
};
