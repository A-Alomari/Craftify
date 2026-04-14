const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { isActive, isCustomerOrGuest } = require('../middleware/auth');

router.use(isActive);
router.use(isCustomerOrGuest);

router.get('/', cartController.index);
router.post('/add', cartController.addItem);
router.post('/update', cartController.updateItem);
router.post('/remove', cartController.removeItem);
router.post('/coupon', cartController.applyCoupon);
router.post('/coupon/remove', cartController.removeCoupon);
router.post('/clear', cartController.clear);

module.exports = router;
