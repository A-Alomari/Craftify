const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');
const { isAuthenticated } = require('../middleware/auth');

router.get('/', auctionController.index);
router.get('/my-bids', isAuthenticated, auctionController.myBids);
router.get('/:id', auctionController.show);
router.post('/:id/bid', isAuthenticated, auctionController.placeBid);
router.get('/:id/data', auctionController.getAuctionData);

module.exports = router;
