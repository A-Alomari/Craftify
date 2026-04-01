const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/', productController.index);
router.get('/search', productController.search);
router.get('/category/:id', productController.byCategory);
router.get('/artisan/:id', productController.byArtisan);
router.get('/:id', productController.show);

module.exports = router;
