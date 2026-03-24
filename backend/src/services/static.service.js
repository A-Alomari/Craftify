const { db } = require("../models");

/**
 * Handles the listFaqs operation.
 * @returns {Promise<unknown>}
 */
async function listFaqs() {
  return db.faq.findMany({ orderBy: { createdAt: "desc" } });
}

/**
 * Handles the createContactMessage operation.
 * @param {unknown} payload
 * @returns {Promise<unknown>}
 */
async function createContactMessage(payload) {
  return db.contactMessage.create({ data: payload });
}

module.exports = {
  listFaqs,
  createContactMessage,
};
