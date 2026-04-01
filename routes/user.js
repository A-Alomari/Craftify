const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { isAuthenticated } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// Configure multer
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

// Profile
router.get('/profile', isAuthenticated, userController.profile);
router.post('/profile', isAuthenticated, upload.single('avatar'), userController.updateProfile);
router.post('/change-password', isAuthenticated, userController.changePassword);

// Wishlist
router.get('/wishlist', isAuthenticated, userController.wishlist);
router.post('/wishlist/add', isAuthenticated, userController.addToWishlist);
router.post('/wishlist/remove', isAuthenticated, userController.removeFromWishlist);
router.post('/wishlist/toggle', isAuthenticated, userController.toggleWishlist);
router.post('/wishlist/move-to-cart', isAuthenticated, userController.moveToCart);

// Reviews
router.get('/reviews', isAuthenticated, userController.reviews);
router.post('/reviews', isAuthenticated, userController.createReview);
router.delete('/reviews/:id', isAuthenticated, userController.deleteReview);
router.post('/reviews/:id/delete', isAuthenticated, userController.deleteReview);

// Notifications
router.get('/notifications', isAuthenticated, userController.notifications);
router.post('/notifications/:id/read', isAuthenticated, userController.markNotificationRead);
router.post('/notifications/read-all', isAuthenticated, userController.markAllNotificationsRead);
router.delete('/notifications/:id', isAuthenticated, userController.deleteNotification);

// Messages
router.get('/messages', isAuthenticated, userController.messages);
router.get('/messages/:userId', isAuthenticated, userController.conversation);
router.post('/messages', isAuthenticated, userController.sendMessage);

// Artisan profile view
router.get('/artisan/:id', userController.viewArtisan);

module.exports = router;
