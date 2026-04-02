const express = require('express');
const router = express.Router();
const { attachUser } = require('../middleware/auth');
const apiController = require('../controllers/apiController');

router.use(attachUser);

router.get('/products', apiController.products);

// Cart count
router.get('/cart/count', apiController.cartCount);

// Notifications
router.get('/notifications', apiController.notifications);

// Wishlist check
router.get('/wishlist/check/:productId', apiController.wishlistCheck);

// Auction updates
router.get('/auctions/:id/updates', apiController.auctionUpdates);

// Validate coupon
router.post('/coupons/validate', apiController.validateCoupon);

// Search suggestions
router.get('/search/suggestions', apiController.searchSuggestions);

module.exports = router;
