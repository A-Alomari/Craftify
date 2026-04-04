const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isActive, isAdmin } = require('../middleware/auth');
const { createImageUpload, validateUploadedImageSignatures } = require('../utils/upload');

const upload = createImageUpload({ maxFileSize: 5 * 1024 * 1024 });

// Apply admin authentication to all routes
router.use(isAuthenticated, isActive, isAdmin);

// Dashboard
router.get('/dashboard', adminController.dashboard);

// Users
router.get('/users', adminController.users);
router.post('/users/:id/status', adminController.updateUserStatus);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/:id/delete', adminController.deleteUser);

// Artisans
router.get('/artisans', adminController.artisans);
router.post('/artisans/:id/approve', adminController.approveArtisan);
router.post('/artisans/:id/reject', adminController.rejectArtisan);

// Products
router.get('/products', adminController.products);
router.post('/products/:id/approve', adminController.approveProduct);
router.post('/products/:id/reject', adminController.rejectProduct);
router.post('/products/:id/featured', adminController.toggleFeatured);

// Categories
router.get('/categories', adminController.categories);
router.post('/categories', upload.single('image'), validateUploadedImageSignatures, adminController.createCategory);
router.post('/categories/:id', upload.single('image'), validateUploadedImageSignatures, adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);
router.post('/categories/:id/delete', adminController.deleteCategory);

// Orders
router.get('/orders', adminController.orders);
router.get('/orders/:id', adminController.orderDetail);
router.post('/orders/:id/status', adminController.updateOrderStatus);

// Auctions
router.get('/auctions', adminController.auctions);
router.post('/auctions/:id/cancel', adminController.cancelAuction);

// Reviews
router.get('/reviews', adminController.reviews);
router.post('/reviews/:id/status', adminController.updateReviewStatus);
router.post('/reviews/:id/approve', adminController.approveReview);
router.delete('/reviews/:id', adminController.deleteReview);
router.post('/reviews/:id/delete', adminController.deleteReview);

// Coupons
router.get('/coupons', adminController.coupons);
router.post('/coupons', adminController.createCoupon);
router.post('/coupons/:id/toggle', adminController.toggleCoupon);
router.delete('/coupons/:id', adminController.deleteCoupon);
router.post('/coupons/:id/delete', adminController.deleteCoupon);

// Reports
router.get('/reports', adminController.reports);

// Settings
router.get('/settings', adminController.settings);

module.exports = router;
