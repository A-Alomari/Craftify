const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
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

// Apply admin authentication to all routes
router.use(isAuthenticated, isAdmin);

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
router.post('/categories', upload.single('image'), adminController.createCategory);
router.post('/categories/:id', upload.single('image'), adminController.updateCategory);
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
