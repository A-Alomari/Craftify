const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', isAuthenticated, orderController.index);
router.get('/checkout', isAuthenticated, orderController.checkout);
router.post('/checkout', isAuthenticated, orderController.placeOrder);
router.get('/:id', isAuthenticated, orderController.show);
router.get('/:id/confirmation', isAuthenticated, orderController.confirmation);
router.get('/:id/track', isAuthenticated, orderController.track);
router.post('/:id/cancel', isAuthenticated, orderController.cancel);

module.exports = router;
