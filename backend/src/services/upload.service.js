const { ValidationError } = require("../utils/http");

/**
 * Convert an uploaded file descriptor into a public image URL.
 * @param {import("multer").File | undefined} file
 * @returns {{ imageUrl: string, filename: string, size: number, mimeType: string }}
 */
function mapUploadedImage(file) {
  if (!file || !file.filename) {
    throw new ValidationError("Image file is required");
  }

  return {
    imageUrl: `/uploads/products/${file.filename}`,
    filename: file.filename,
    size: Number(file.size || 0),
    mimeType: file.mimetype || "application/octet-stream",
  };
}

module.exports = {
  mapUploadedImage,
};
