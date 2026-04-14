const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const userController = require('../controllers/userController');
const { isAuthenticated, isActive, isCustomer } = require('../middleware/auth');
const { createImageUpload, validateUploadedImageSignatures } = require('../utils/upload');

const upload = createImageUpload({ maxFileSize: 30 * 1024 * 1024 });
const isTest = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('jest'));

const messageLimiter = isTest
	? (req, res, next) => next()
	: rateLimit({
			windowMs: 60 * 1000,
			max: 30,
			standardHeaders: true,
			legacyHeaders: false,
			message: { success: false, message: 'Too many messages sent. Please wait a minute and try again.' }
		});

// Profile
router.get('/profile', isAuthenticated, isActive, userController.profile);
router.post('/profile', isAuthenticated, isActive, upload.single('avatar'), validateUploadedImageSignatures, userController.updateProfile);
router.post('/change-password', isAuthenticated, isActive, userController.changePassword);

// Wishlist
router.get('/wishlist', isAuthenticated, isActive, isCustomer, userController.wishlist);
router.post('/wishlist/add', isAuthenticated, isActive, isCustomer, userController.addToWishlist);
router.post('/wishlist/remove', isAuthenticated, isActive, isCustomer, userController.removeFromWishlist);
router.post('/wishlist/toggle', isAuthenticated, isActive, isCustomer, userController.toggleWishlist);
router.post('/wishlist/move-to-cart', isAuthenticated, isActive, isCustomer, userController.moveToCart);

// Reviews
router.get('/reviews', isAuthenticated, isActive, isCustomer, userController.reviews);
router.post('/reviews', isAuthenticated, isActive, isCustomer, userController.createReview);
router.delete('/reviews/:id', isAuthenticated, isActive, isCustomer, userController.deleteReview);
router.post('/reviews/:id/delete', isAuthenticated, isActive, isCustomer, userController.deleteReview);

// Notifications
router.get('/notifications', isAuthenticated, isActive, userController.notifications);
router.post('/notifications/:id/read', isAuthenticated, isActive, userController.markNotificationRead);
router.post('/notifications/read-all', isAuthenticated, isActive, userController.markAllNotificationsRead);
router.delete('/notifications/:id', isAuthenticated, isActive, userController.deleteNotification);

// Messages
router.get('/messages', isAuthenticated, isActive, userController.messages);
router.get('/messages/:userId', isAuthenticated, isActive, userController.conversation);
router.post('/messages', isAuthenticated, isActive, messageLimiter, upload.single('message_image'), validateUploadedImageSignatures, userController.sendMessage);

// Artisan profile view
router.get('/artisan/:id', userController.viewArtisan);

module.exports = router;
