const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', '.uploads');

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

function hasValidImageSignature(filePath, mimetype) {
  const signatureLength = 12;
  const buffer = Buffer.alloc(signatureLength);
  let bytesRead = 0;

  try {
    const fd = fs.openSync(filePath, 'r');
    try {
      bytesRead = fs.readSync(fd, buffer, 0, signatureLength, 0);
    } finally {
      fs.closeSync(fd);
    }

    if (bytesRead < signatureLength) {
      return false;
    }

    if (mimetype === 'image/jpeg') {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    if (mimetype === 'image/png') {
      return buffer[0] === 0x89
        && buffer[1] === 0x50
        && buffer[2] === 0x4e
        && buffer[3] === 0x47
        && buffer[4] === 0x0d
        && buffer[5] === 0x0a
        && buffer[6] === 0x1a
        && buffer[7] === 0x0a;
    }

    if (mimetype === 'image/webp') {
      return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    }

    return false;
  } catch (err) {
    return false;
  }
}

function validateUploadedImageSignatures(req, res, next) {
  const uploadedFiles = [];

  if (req.file) {
    uploadedFiles.push(req.file);
  }

  if (Array.isArray(req.files)) {
    uploadedFiles.push(...req.files);
  } else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach((entry) => {
      if (Array.isArray(entry)) {
        uploadedFiles.push(...entry);
      } else if (entry) {
        uploadedFiles.push(entry);
      }
    });
  }

  for (const file of uploadedFiles) {
    if (!file || !file.path) {
      continue;
    }

    if (!hasValidImageSignature(file.path, file.mimetype)) {
      try {
        fs.unlinkSync(file.path);
      } catch (unlinkErr) {
        // best-effort cleanup
      }

      const err = new Error('Uploaded file content does not match an allowed image format.');
      err.status = 400;
      return next(err);
    }
  }

  return next();
}

module.exports = {
  createImageUpload,
  allowedImageTypes,
  validateUploadedImageSignatures
};
