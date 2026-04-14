const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { isAuthenticated, isActive, isCustomer } = require('../middleware/auth');

router.get('/', isAuthenticated, isActive, isCustomer, orderController.index);
router.get('/checkout', isAuthenticated, isActive, isCustomer, orderController.checkout);
router.post('/checkout', isAuthenticated, isActive, isCustomer, orderController.placeOrder);
router.get('/:id', isAuthenticated, isActive, isCustomer, orderController.show);
router.get('/:id/confirmation', isAuthenticated, isActive, isCustomer, orderController.confirmation);
router.get('/:id/track', isAuthenticated, isActive, isCustomer, orderController.track);
router.post('/:id/cancel', isAuthenticated, isActive, isCustomer, orderController.cancel);

module.exports = router;
