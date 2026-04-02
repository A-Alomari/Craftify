const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isGuest } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { createImageUpload } = require('../utils/upload');

// Rate limiting (disabled during tests)
const isTest = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('jest'));

const loginLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many login attempts, please try again later.' }
    });

const registerLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many registration attempts, please try again later.' }
    });

const forgotPasswordLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many password reset requests, please try again later.' }
    });

const resetPasswordLimiter = isTest
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many reset attempts, please try again later.' }
    });

const upload = createImageUpload({ maxFileSize: 5 * 1024 * 1024 });

function handleValidationErrors(redirectTo) {
  return (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    req.flash('error_msg', errors.array().map(err => err.msg).join('. '));
    return res.redirect(redirectTo(req));
  };
}

const loginValidation = [
  body('email').trim().isEmail().withMessage('Please enter a valid email address'),
  body('password').notEmpty().withMessage('Password is required')
];

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Please enter a valid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirm_password').custom((value, { req }) => {
    const confirm = value || req.body.confirmPassword;
    if (req.body.password !== confirm) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
];

const artisanRegisterValidation = [
  ...registerValidation,
  body('shop_name').trim().notEmpty().withMessage('Shop name is required')
];

const forgotPasswordValidation = [
  body('email').trim().isEmail().withMessage('Please enter a valid email address')
];

const resetPasswordValidation = [
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('confirm_password').custom((value, { req }) => {
    if (req.body.password !== value) {
      throw new Error('Passwords do not match');
    }
    return true;
  })
];

// Login
router.get('/login', isGuest, authController.showLogin);
router.post('/login', loginLimiter, loginValidation, handleValidationErrors(() => '/auth/login'), authController.login);

// Register (Customer)
router.get('/register', isGuest, authController.showRegister);
router.post('/register', registerLimiter, registerValidation, handleValidationErrors(() => '/auth/register'), authController.register);

// Register (Artisan)
router.get('/artisan-register', isGuest, authController.showArtisanRegister);
router.post(
  '/artisan-register',
  upload.single('profile_image'),
  artisanRegisterValidation,
  handleValidationErrors(() => '/auth/artisan-register'),
  authController.registerArtisan
);

// Logout
router.get('/logout', (req, res) => res.redirect('/'));
router.post('/logout', authController.logout);

// Forgot Password
router.get('/forgot-password', isGuest, authController.showForgotPassword);
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  forgotPasswordValidation,
  handleValidationErrors(() => '/auth/forgot-password'),
  authController.forgotPassword
);

// Reset Password
router.get('/reset-password/:token', isGuest, authController.showResetPassword);
router.post(
  '/reset-password/:token',
  resetPasswordLimiter,
  resetPasswordValidation,
  handleValidationErrors((req) => `/auth/reset-password/${req.params.token}`),
  authController.resetPassword
);

module.exports = router;
