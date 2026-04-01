const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isGuest } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Login
router.get('/login', isGuest, authController.showLogin);
router.post('/login', authController.login);

// Register (Customer)
router.get('/register', isGuest, authController.showRegister);
router.post('/register', authController.register);

// Register (Artisan)
router.get('/artisan-register', isGuest, authController.showArtisanRegister);
router.post('/artisan-register', upload.single('profile_image'), authController.registerArtisan);

// Logout
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

// Forgot Password
router.get('/forgot-password', isGuest, authController.showForgotPassword);
router.post('/forgot-password', authController.forgotPassword);

// Reset Password
router.get('/reset-password/:token', isGuest, authController.showResetPassword);
router.post('/reset-password/:token', authController.resetPassword);

module.exports = router;
