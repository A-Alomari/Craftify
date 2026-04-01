const express = require('express');
const router = express.Router();
const artisanController = require('../controllers/artisanController');
const { isAuthenticated, isArtisan, isApprovedArtisan } = require('../middleware/auth');
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

// Apply artisan authentication to all routes
router.use(isAuthenticated, isArtisan);

// Dashboard
router.get('/dashboard', isApprovedArtisan, artisanController.dashboard);

// Pending approval
router.get('/pending', artisanController.pending);

// Profile
router.get('/profile', artisanController.profile);
router.post('/profile', upload.single('profile_image'), artisanController.updateProfile);

// Products
router.get('/products', isApprovedArtisan, artisanController.products);
router.get('/products/new', isApprovedArtisan, artisanController.newProduct);
router.post('/products', isApprovedArtisan, upload.array('images', 5), artisanController.createProduct);
router.get('/products/:id/edit', isApprovedArtisan, artisanController.editProduct);
router.post('/products/:id', isApprovedArtisan, upload.array('images', 5), artisanController.updateProduct);
router.delete('/products/:id', isApprovedArtisan, artisanController.deleteProduct);
router.post('/products/:id/delete', isApprovedArtisan, artisanController.deleteProduct);

// Orders
router.get('/orders', isApprovedArtisan, artisanController.orders);
router.get('/orders/:id', isApprovedArtisan, artisanController.orderDetail);
router.post('/orders/:id/status', isApprovedArtisan, artisanController.updateOrderStatus);

// Auctions
router.get('/auctions', isApprovedArtisan, artisanController.auctions);
router.get('/auctions/new', isApprovedArtisan, artisanController.newAuction);
router.post('/auctions', isApprovedArtisan, artisanController.createAuction);
router.post('/auctions/:id/cancel', isApprovedArtisan, artisanController.cancelAuction);

// Reviews
router.get('/reviews', isApprovedArtisan, artisanController.reviews);

// Analytics
router.get('/analytics', isApprovedArtisan, artisanController.analytics);

module.exports = router;
