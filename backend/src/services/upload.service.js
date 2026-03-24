/**
 * Handles the normalizeUpload operation.
 * @param {unknown} files
 * @returns {Promise<unknown>}
 */
async function normalizeUpload(files) {
  return Array.isArray(files) ? files : files ? [files] : [];
}

module.exports = {
  normalizeUpload,
};
