const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'public', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const allowedImageTypes = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp']
};

function imageFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const allowedExtensions = allowedImageTypes[file.mimetype];

  if (!allowedExtensions || !allowedExtensions.includes(ext)) {
    return cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
  }

  return cb(null, true);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname).toLowerCase();
    cb(null, uniqueName);
  }
});

function createImageUpload(options = {}) {
  const { maxFileSize = 5 * 1024 * 1024, maxFiles } = options;
  const limits = { fileSize: maxFileSize };

  if (typeof maxFiles === 'number') {
    limits.files = maxFiles;
  }

  return multer({
    storage,
    limits,
    fileFilter: imageFileFilter
  });
}

module.exports = {
  createImageUpload,
  allowedImageTypes
};
