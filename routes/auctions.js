const express = require('express');
const router = express.Router();
const auctionController = require('../controllers/auctionController');
const { isAuthenticated } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const isTest = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('jest'));

const bidLimiter = isTest
	? (req, res, next) => next()
	: rateLimit({
			windowMs: 60 * 1000, // 1 minute
			max: 20,
			standardHeaders: true,
			legacyHeaders: false,
			message: { error: 'Too many bid attempts. Please wait a minute and try again.' }
		});

router.get('/', auctionController.index);
router.get('/my-bids', isAuthenticated, auctionController.myBids);
router.get('/:id', auctionController.show);
router.post('/:id/bid', isAuthenticated, bidLimiter, auctionController.placeBid);
router.get('/:id/data', auctionController.getAuctionData);

module.exports = router;
