const express = require('express');
const router = express.Router();
const homeController = require('../controllers/homeController');

router.get('/', homeController.index);
router.get('/about', homeController.about);
router.get('/contact', homeController.contact);
router.get('/faq', homeController.faq);
router.get('/terms', homeController.terms);
router.get('/privacy', homeController.privacy);
router.post('/subscribe', homeController.subscribe);

module.exports = router;
