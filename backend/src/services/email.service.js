/**
 * Handles the sendEmail operation.
 * @param {unknown} _payload
 * @returns {Promise<unknown>}
 */
async function sendEmail(_payload) {
  return { queued: true };
}

module.exports = {
  sendEmail,
};
