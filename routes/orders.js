const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { isAuthenticated, isActive } = require('../middleware/auth');

router.get('/', isAuthenticated, isActive, orderController.index);
router.get('/checkout', isAuthenticated, isActive, orderController.checkout);
router.post('/checkout', isAuthenticated, isActive, orderController.placeOrder);
router.get('/:id', isAuthenticated, isActive, orderController.show);
router.get('/:id/confirmation', isAuthenticated, isActive, orderController.confirmation);
router.get('/:id/track', isAuthenticated, isActive, orderController.track);
router.post('/:id/cancel', isAuthenticated, isActive, orderController.cancel);

module.exports = router;
